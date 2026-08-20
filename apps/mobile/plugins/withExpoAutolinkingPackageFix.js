// `expo/config-plugins` is Expo's supported public entry point. Importing the
// underlying package directly is not reliable with EAS's pnpm layout.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// NotesChain: normalize Expo autolinking package import.';

/**
 * EAS + pnpm can generate PackageList.java with Expo's obsolete SDK 40-era
 * import (`expo.core.ExpoModulesPackage`). Expo SDK 52 provides that class in
 * `expo.modules`; normalize the generated file immediately after React Native
 * has created it and before Java compilation begins.
 */
module.exports = function withExpoAutolinkingPackageFix(config) {
  return withAppBuildGradle(config, (modifiedConfig) => {
    if (modifiedConfig.modResults.contents.includes(MARKER)) {
      return modifiedConfig;
    }

    modifiedConfig.modResults.contents += `

${MARKER}
tasks.configureEach { task ->
    if (task.name == 'generateAutolinkingPackageList') {
        task.doLast {
            def packageList = file("$buildDir/generated/autolinking/src/main/java/com/facebook/react/PackageList.java")
            if (packageList.exists()) {
                def generatedContents = packageList.getText('UTF-8')
                def legacyImport = 'import expo.core.ExpoModulesPackage;'
                if (generatedContents.contains(legacyImport)) {
                    packageList.setText(
                        generatedContents.replace(legacyImport, 'import expo.modules.ExpoModulesPackage;'),
                        'UTF-8'
                    )
                }
            }
        }
    }
}
`;

    return modifiedConfig;
  });
};
