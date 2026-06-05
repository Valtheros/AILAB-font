export function FieldError({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  if (!message) {
    return null;
  }

  return (
    <p className="text-xs leading-5 text-destructive" id={id}>
      {message}
    </p>
  );
}
