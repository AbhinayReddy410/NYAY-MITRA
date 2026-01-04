'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';

const DATE_LOCALE = 'en-IN';
const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
const TIME_OPTIONS: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

const SUCCESS_TITLE = 'Draft Generated!';
const DOWNLOAD_LABEL = 'Download Document';
const GENERATE_ANOTHER_LABEL = 'Generate Another';
const DASHBOARD_LABEL = 'Go to Dashboard';
const GENERATED_PREFIX = 'Generated on';
const TEMPLATE_FALLBACK = 'Template';

const DOWNLOAD_LINK_MISSING_MESSAGE = 'Download link unavailable.';

type DraftPageProps = {
  params: {
    id: string;
  };
};

function formatDate(value: Date): string {
  return value.toLocaleDateString(DATE_LOCALE, DATE_OPTIONS);
}

function formatTime(value: Date): string {
  return value.toLocaleTimeString(DATE_LOCALE, TIME_OPTIONS);
}

export default function DraftPage({ params }: DraftPageProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = params.id;
  const downloadUrl = searchParams.get('downloadUrl') ?? '';
  const templateName = searchParams.get('templateName') ?? '';

  const generatedAt = useMemo((): Date => new Date(), []);
  const formattedDate = useMemo((): string => formatDate(generatedAt), [generatedAt]);
  const formattedTime = useMemo((): string => formatTime(generatedAt), [generatedAt]);

  const hasDownloadUrl = downloadUrl.length > 0;
  const templateLabel = templateName.trim().length > 0 ? templateName : TEMPLATE_FALLBACK;

  const handleDownload = useCallback((): void => {
    if (!hasDownloadUrl) {
      return;
    }

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${draftId}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [downloadUrl, draftId, hasDownloadUrl]);

  const handleGenerateAnother = useCallback((): void => {
    router.back();
  }, [router]);

  const errorMessage = !hasDownloadUrl ? DOWNLOAD_LINK_MISSING_MESSAGE : '';

  return (
    <div className='flex items-center justify-center py-12'>
      <Card className='w-full max-w-lg'>
        <div className='flex flex-col items-center text-center'>
          <div className='flex h-16 w-16 items-center justify-center rounded-full bg-green-500'>
            <svg
              className='h-8 w-8 text-white'
              fill='none'
              stroke='currentColor'
              strokeWidth={3}
              viewBox='0 0 24 24'
            >
              <path d='M5 13l4 4L19 7' strokeLinecap='round' strokeLinejoin='round' />
            </svg>
          </div>

          <h1 className='mt-5 text-2xl font-semibold text-slate-900'>{SUCCESS_TITLE}</h1>
          <h2 className='mt-2 text-base font-semibold text-slate-900'>{templateLabel}</h2>
          <p className='mt-2 text-sm text-slate-500'>
            {GENERATED_PREFIX} {formattedDate} at {formattedTime}
          </p>

          <div className='mt-8 w-full space-y-3'>
            <Button
              className='w-full'
              disabled={!hasDownloadUrl}
              onClick={handleDownload}
              type='button'
            >
              {DOWNLOAD_LABEL}
            </Button>

            {errorMessage ? <p className='text-sm text-red-600'>{errorMessage}</p> : null}
          </div>

          <div className='mt-8 flex flex-col items-center gap-3'>
            <button
              className='text-sm font-semibold text-slate-900 hover:text-slate-700'
              onClick={handleGenerateAnother}
              type='button'
            >
              {GENERATE_ANOTHER_LABEL}
            </button>
            <Link className='text-sm text-slate-600 hover:text-slate-900' href='/dashboard'>
              {DASHBOARD_LABEL}
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
