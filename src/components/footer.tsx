export function Footer() {
  return (
    <footer className="border-t py-6">
      <div className="container mx-auto flex flex-col items-center gap-2 px-4 text-center text-sm text-muted-foreground">
        <p>GameJam Organizer &mdash; Free &amp; Open Source</p>
        <p>&copy; {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}
