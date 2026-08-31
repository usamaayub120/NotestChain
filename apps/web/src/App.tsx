import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { RequirePermission } from "@/components/RequirePermission";
import { RequireAnyPermission } from "@/components/RequireAnyPermission";
import { Permission } from "@noteschain/shared";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PublishedNotesPage } from "@/pages/PublishedNotesPage";
import { ExplorePage } from "@/pages/ExplorePage";
import { SearchPage } from "@/pages/SearchPage";
import { TagPage } from "@/pages/TagPage";
import { PublicationReaderPage } from "@/pages/PublicationReaderPage";
import { ProfileHandleRoute } from "@/pages/ProfileHandleRoute";
import { BookmarksPage } from "@/pages/BookmarksPage";
import { DraftsListPage } from "@/pages/drafts/DraftsListPage";
import { DraftEditorPage } from "@/pages/drafts/DraftEditorPage";
import { IdentitiesPage } from "@/pages/identities/IdentitiesPage";
import { NewIdentityPage } from "@/pages/identities/NewIdentityPage";
import { EditIdentityPage } from "@/pages/identities/EditIdentityPage";
import { ModerationQueuePage } from "@/pages/admin/ModerationQueuePage";
import { ModerationSubmissionDetailPage } from "@/pages/admin/ModerationSubmissionDetailPage";
import { AdminHomePage } from "@/pages/admin/AdminHomePage";
import { ReportsQueuePage } from "@/pages/admin/ReportsQueuePage";
import { AuditLogPage } from "@/pages/admin/AuditLogPage";
import { BlockchainJobsPage } from "@/pages/admin/BlockchainJobsPage";
import { ViewsPage } from "@/pages/admin/ViewsPage";
import { SeoSettingsPage } from "@/pages/admin/SeoSettingsPage";
import { WalletBalancesPage } from "@/pages/admin/WalletBalancesPage";
import { UsersPage } from "@/pages/admin/UsersPage";
import { StaffAccessPage } from "@/pages/admin/StaffAccessPage";
import { CampaignsPage } from "@/pages/admin/CampaignsPage";
import { HowItWorksPage } from "@/pages/HowItWorksPage";
import { VerifyNotePage } from "@/pages/VerifyNotePage";
import { PrivacyPolicyPage } from "@/pages/PrivacyPolicyPage";
import { TermsOfServicePage } from "@/pages/TermsOfServicePage";
import { DeleteAccountPage } from "@/pages/DeleteAccountPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { MobileCaptchaPage } from "@/pages/MobileCaptchaPage";
import { StaffInvitationPage } from "@/pages/StaffInvitationPage";

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/mobile-captcha" element={<MobileCaptchaPage />} />
        <Route path="/access/invitation" element={<StaffInvitationPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/verify" element={<VerifyNotePage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/delete-account" element={<DeleteAccountPage />} />
        <Route path="/tags/:tag" element={<TagPage />} />
        <Route path="/p/:id" element={<PublicationReaderPage />} />
        <Route path="/:handle" element={<ProfileHandleRoute />} />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/published-notes"
          element={<RequireAuth><PublishedNotesPage /></RequireAuth>}
        />
        <Route
          path="/drafts"
          element={
            <RequireAuth>
              <DraftsListPage />
            </RequireAuth>
          }
        />
        <Route
          path="/drafts/:id/edit"
          element={
            <RequireAuth>
              <DraftEditorPage />
            </RequireAuth>
          }
        />
        <Route
          path="/identities"
          element={
            <RequireAuth>
              <IdentitiesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/identities/new"
          element={
            <RequireAuth>
              <NewIdentityPage />
            </RequireAuth>
          }
        />
        <Route
          path="/identities/:id/edit"
          element={
            <RequireAuth>
              <EditIdentityPage />
            </RequireAuth>
          }
        />
        <Route
          path="/bookmarks"
          element={
            <RequireAuth>
              <BookmarksPage />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireAnyPermission permissions={[Permission.MODERATE_CONTENT, Permission.CREATE_CAMPAIGN, Permission.APPROVE_CAMPAIGN, Permission.MANAGE_PLATFORM, Permission.MANAGE_STAFF_ACCESS]}>
              <AdminHomePage />
            </RequireAnyPermission>
          }
        />
        <Route
          path="/admin/submissions"
          element={
            <RequirePermission permission={Permission.MODERATE_CONTENT}>
              <ModerationQueuePage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/submissions/:id"
          element={
            <RequirePermission permission={Permission.MODERATE_CONTENT}>
              <ModerationSubmissionDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <RequirePermission permission={Permission.MODERATE_CONTENT}>
              <ReportsQueuePage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/audit-log"
          element={
            <RequirePermission permission={Permission.MANAGE_PLATFORM}>
              <AuditLogPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/blockchain"
          element={
            <RequirePermission permission={Permission.MANAGE_PLATFORM}>
              <BlockchainJobsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/wallets"
          element={
            <RequirePermission permission={Permission.MANAGE_PLATFORM}>
              <WalletBalancesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/views"
          element={
            <RequirePermission permission={Permission.MANAGE_PLATFORM}>
              <ViewsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequirePermission permission={Permission.MANAGE_PLATFORM}>
              <UsersPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <RequirePermission permission={Permission.MANAGE_PLATFORM}>
              <SeoSettingsPage />
            </RequirePermission>
          }
        />
        <Route path="/admin/access" element={<RequirePermission permission={Permission.MANAGE_STAFF_ACCESS}><StaffAccessPage /></RequirePermission>} />
        <Route path="/admin/campaigns" element={<RequireAnyPermission permissions={[Permission.CREATE_CAMPAIGN, Permission.APPROVE_CAMPAIGN]}><CampaignsPage /></RequireAnyPermission>} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}
