'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import type { Section } from '@/shared/types/blocks/landing';

const MailIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={className}
    aria-hidden
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M22 6l-10 7L2 6" />
  </svg>
);

const SendIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={className}
    aria-hidden
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L15 22l-4-9-9-4 20-7z" />
  </svg>
);

const SpinnerIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={className}
    aria-hidden
  >
    <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" />
  </svg>
);

export function Subscribe({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!email) {
      return;
    }

    if (!section.submit?.action) {
      return;
    }

    try {
      setLoading(true);
      const resp = await fetch(section.submit.action, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      if (!resp.ok) {
        throw new Error(`request failed with status ${resp.status}`);
      }

      const { code, message, data } = await resp.json();
      if (code !== 0) {
        throw new Error(message);
      }

      setLoading(false);

      if (message) {
        toast.success(message);
      }
    } catch (e: any) {
      setLoading(false);
      toast.error(e.message || 'subscribe failed');
    }
  };

  return (
    <section
      id={section.id}
      className={cn('py-16 md:py-24', section.className, className)}
    >
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <h2 className="font-display text-4xl font-semibold text-balance lg:text-5xl">
            {section.title}
          </h2>
          <p className="font-display mt-4">{section.description}</p>

          <div className="mx-auto mt-10 max-w-xl overflow-hidden lg:mt-12">
            <div className="bg-background has-[input:focus]:ring-muted relative grid grid-cols-[1fr_auto] items-center overflow-hidden rounded-[calc(var(--radius)+0.75rem)] border pr-3 shadow shadow-zinc-950/5 has-[input:focus]:ring-2">
              <MailIcon className="text-caption pointer-events-none absolute inset-y-0 left-5 my-auto size-5" />

              <input
                placeholder={
                  section.submit?.input?.placeholder || 'Enter your email'
                }
                className="h-14 w-full bg-transparent pl-12 focus:outline-none"
                type="email"
                required
                aria-required="true"
                aria-invalid={!email}
                aria-describedby="email-error"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              {section.submit?.button && (
                <div className="md:pr-1.5 lg:pr-0">
                  <Button
                    aria-label="submit"
                    className="rounded-(--radius)"
                    onClick={handleSubscribe}
                    disabled={loading}
                    type="submit"
                  >
                      {loading ? (
                        <SpinnerIcon className="animate-spin" />
                      ) : (
                        <span className="hidden md:block">
                          {section.submit.button.title}
                        </span>
                      )}
                      <SendIcon
                        className="relative mx-auto size-5 md:hidden"
                      />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
