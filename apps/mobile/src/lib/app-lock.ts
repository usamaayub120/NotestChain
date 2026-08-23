import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";

const pinHashKey = "noteschain.mobile.pinhash";
const pinSaltKey = "noteschain.mobile.pinsalt";
const biometricKey = "noteschain.mobile.biometric";

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function hasPinSet(): Promise<boolean> {
  return Boolean(await SecureStore.getItemAsync(pinHashKey));
}

export async function setPin(pin: string): Promise<void> {
  const salt = Array.from(await Crypto.getRandomBytesAsync(16), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const hash = await hashPin(pin, salt);
  await SecureStore.setItemAsync(pinSaltKey, salt);
  await SecureStore.setItemAsync(pinHashKey, hash);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const [salt, storedHash] = await Promise.all([SecureStore.getItemAsync(pinSaltKey), SecureStore.getItemAsync(pinHashKey)]);
  if (!salt || !storedHash) return false;
  return (await hashPin(pin, salt)) === storedHash;
}

/** Clears the PIN and disables biometric unlock — the whole app-lock feature, off. */
export async function clearAppLock(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(pinHashKey),
    SecureStore.deleteItemAsync(pinSaltKey),
    SecureStore.deleteItemAsync(biometricKey),
  ]);
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(biometricKey)) === "1";
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (enabled) await SecureStore.setItemAsync(biometricKey, "1");
  else await SecureStore.deleteItemAsync(biometricKey);
}

export async function isBiometricAvailable(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
  return hasHardware && isEnrolled;
}

/** "Face unlock" on devices that support it, "Fingerprint" otherwise — matters once iOS ships too. */
export async function biometricLabel(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  return types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ? "Face unlock" : "Fingerprint";
}

export async function authenticateWithBiometrics(promptMessage = "Unlock NotesChain"): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({ promptMessage, disableDeviceFallback: true, cancelLabel: "Use PIN instead" });
  return result.success;
}
