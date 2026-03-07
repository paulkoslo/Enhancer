import { SettingsForm } from "@/components/settings-form";

export default function SettingsPage() {
  return (
    <main className="shell">
      <header className="hero">
        <div className="eyebrow">Workspace Settings</div>
        <h1 className="title">Control model access and defaults.</h1>
        <p className="subtitle">
          The backend routes model traffic through OpenRouter, but the default profile and workspace key are managed
          here.
        </p>
      </header>
      <SettingsForm />
    </main>
  );
}
