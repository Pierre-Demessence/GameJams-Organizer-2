export default function Loading() {
  return (
    <div className="container mx-auto flex min-h-[40vh] items-center justify-center px-4">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
