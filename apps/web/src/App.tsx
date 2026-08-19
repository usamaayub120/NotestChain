import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireRole } from "@/components/RequireRole";
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
import { ModerationQueuePage } from "@/pages/admin/ModerationQueuePage";
import { ModerationSubmissionDetailPage } from "@/pages/admin/ModerationSubmissionDetailPage";
import { AdminHomePage } from "@/pages/admin/AdminHomePage";
import { ReportsQueuePage } from "@/pages/admin/ReportsQueuePage";
import { AuditLogPage } from "@/pages/admin/AuditLogPage";
import { BlockchainJobsPage } from "@/pages/admin/BlockchainJobsPage";
import { ViewsPage } from "@/pages/admin/ViewsPage";
import { ComingSoonPage } from "@/pages/ComingSoonPage";
import { HowItWorksPage } from "@/pages/HowItWorksPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { MobileCaptchaPage } from "@/pages/MobileCaptchaPage";

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
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
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
              <ComingSoonPage title="Settings" description="Account and session management." />
            </RequireAuth>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireRole role="MODERATOR">
              <AdminHomePage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/submissions"
          element={
            <RequireRole role="MODERATOR">
              <ModerationQueuePage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/submissions/:id"
          element={
            <RequireRole role="MODERATOR">
              <ModerationSubmissionDetailPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <RequireRole role="ADMIN">
              <ReportsQueuePage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/audit-log"
          element={
            <RequireRole role="ADMIN">
              <AuditLogPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/blockchain"
          element={
            <RequireRole role="ADMIN">
              <BlockchainJobsPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/views"
          element={
            <RequireRole role="ADMIN">
              <ViewsPage />
            </RequireRole>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}
