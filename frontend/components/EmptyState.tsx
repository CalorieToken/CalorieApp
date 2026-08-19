type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-xl border-2 border-dashed border-brand-secondary/20 bg-brand-bg p-4 sm:p-5 text-sm text-brand-secondary/75 transition">
      <p className="font-semibold text-brand-primary">{title}</p>
      <p className="mt-1">{description}</p>
    </div>
  );
}
