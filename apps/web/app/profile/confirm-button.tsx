'use client';

export function ConfirmButton({ message, children }: { message: string; children: React.ReactNode }) {
  return (
    <button
      className="linkbtn"
      type="submit"
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
