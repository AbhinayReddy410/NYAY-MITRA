import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, Text, View } from 'react-native';

type DraftParams = {
  id?: string;
  downloadUrl?: string;
  templateName?: string;
};

const DATE_LOCALE = 'en-IN';
const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
const TIME_OPTIONS: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

const SUCCESS_TITLE = 'Draft Generated!';
const DOWNLOAD_LABEL = 'Download Document';
const DOWNLOADING_LABEL = 'Downloading...';
const SHARE_LABEL = 'Share';
const GENERATE_ANOTHER_LABEL = 'Generate Another';
const DASHBOARD_LABEL = 'Go to Dashboard';
const GENERATED_PREFIX = 'Generated on';
const TEMPLATE_FALLBACK = 'Template';

const DRAFT_FILE_NAME = 'draft.docx';

const DOWNLOAD_ERROR_MESSAGE = 'Unable to download document.';
const DOWNLOAD_LINK_MISSING_MESSAGE = 'Download link unavailable.';
const DRAFT_ID_MISSING_MESSAGE = 'Draft reference unavailable.';
const STORAGE_ERROR_MESSAGE = 'Unable to access storage.';
const SHARE_UNAVAILABLE_MESSAGE = 'Sharing is not available on this device.';

const SUCCESS_BACKGROUND = '#22C55E';
const CHECKMARK_COLOR = '#FFFFFF';
const CHECKMARK_SIZE = 28;
const PRIMARY_BUTTON_COLOR = '#0F172A';
const PRIMARY_TEXT_COLOR = '#FFFFFF';
const SECONDARY_BORDER = '#E2E8F0';
const SECONDARY_TEXT_COLOR = '#0F172A';

function formatDate(value: Date): string {
  return value.toLocaleDateString(DATE_LOCALE, DATE_OPTIONS);
}

function formatTime(value: Date): string {
  return value.toLocaleTimeString(DATE_LOCALE, TIME_OPTIONS);
}

export function DraftScreen(): JSX.Element {
  const { id, downloadUrl: rawDownloadUrl, templateName: rawTemplateName } = useLocalSearchParams<DraftParams>();
  const draftId = typeof id === 'string' ? id : '';
  const downloadUrl = typeof rawDownloadUrl === 'string' ? rawDownloadUrl : '';
  const templateName = typeof rawTemplateName === 'string' ? rawTemplateName : '';

  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const generatedAt = useMemo((): Date => new Date(), []);
  const formattedDate = useMemo((): string => formatDate(generatedAt), [generatedAt]);
  const formattedTime = useMemo((): string => formatTime(generatedAt), [generatedAt]);

  const hasDraftId = draftId.length > 0;
  const hasDownloadUrl = downloadUrl.length > 0;
  const templateLabel = templateName.trim().length > 0 ? templateName : TEMPLATE_FALLBACK;

  const handleDownload = useCallback(async (): Promise<void> => {
    if (isDownloading) {
      return;
    }
    if (!hasDraftId) {
      setErrorMessage(DRAFT_ID_MISSING_MESSAGE);
      return;
    }
    if (!hasDownloadUrl) {
      setErrorMessage(DOWNLOAD_LINK_MISSING_MESSAGE);
      return;
    }

    setErrorMessage('');
    setIsDownloading(true);
    try {
      const documentDirectory = FileSystem.documentDirectory;
      if (!documentDirectory) {
        throw new Error(STORAGE_ERROR_MESSAGE);
      }
      const fileUri = documentDirectory + DRAFT_FILE_NAME;
      await FileSystem.downloadAsync(downloadUrl, fileUri);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        throw new Error(SHARE_UNAVAILABLE_MESSAGE);
      }
      await Sharing.shareAsync(fileUri);
    } catch (error) {
      const message = error instanceof Error ? error.message : DOWNLOAD_ERROR_MESSAGE;
      setErrorMessage(message);
    } finally {
      setIsDownloading(false);
    }
  }, [downloadUrl, hasDownloadUrl, hasDraftId, isDownloading]);

  const handleGenerateAnother = useCallback((): void => {
    router.back();
  }, []);

  const handleDashboard = useCallback((): void => {
    router.push('/(main)');
  }, []);

  const isActionDisabled = isDownloading || !hasDownloadUrl || !hasDraftId;
  const downloadLabel = isDownloading ? DOWNLOADING_LABEL : DOWNLOAD_LABEL;

  let statusMessage = errorMessage;
  if (!statusMessage && !hasDraftId) {
    statusMessage = DRAFT_ID_MISSING_MESSAGE;
  } else if (!statusMessage && !hasDownloadUrl) {
    statusMessage = DOWNLOAD_LINK_MISSING_MESSAGE;
  }

  return (
    <SafeAreaView className='flex-1 bg-white'>
      <View className='flex-1 px-6'>
        <View className='items-center mt-10'>
          <View className='h-16 w-16 items-center justify-center rounded-full' style={{ backgroundColor: SUCCESS_BACKGROUND }}>
            <Ionicons color={CHECKMARK_COLOR} name='checkmark' size={CHECKMARK_SIZE} />
          </View>
          <Text className='mt-5 text-2xl font-semibold text-slate-900'>{SUCCESS_TITLE}</Text>
          <Text className='mt-2 text-base font-semibold text-slate-900 text-center'>{templateLabel}</Text>
          <Text className='mt-2 text-sm text-slate-500'>
            {GENERATED_PREFIX} {formattedDate} at {formattedTime}
          </Text>
        </View>

        <View className='mt-10'>
          <Pressable
            className={`w-full rounded-xl py-3 items-center ${isActionDisabled ? 'opacity-60' : ''}`}
            disabled={isActionDisabled}
            onPress={handleDownload}
            style={{ backgroundColor: PRIMARY_BUTTON_COLOR }}
          >
            {isDownloading ? (
              <View className='flex-row items-center'>
                <ActivityIndicator color={PRIMARY_TEXT_COLOR} />
                <Text className='ml-2 text-base font-semibold text-white'>{downloadLabel}</Text>
              </View>
            ) : (
              <Text className='text-base font-semibold text-white'>{downloadLabel}</Text>
            )}
          </Pressable>

          <Pressable
            className={`mt-3 w-full rounded-xl py-3 items-center border ${isActionDisabled ? 'opacity-60' : ''}`}
            disabled={isActionDisabled}
            onPress={handleDownload}
            style={{ borderColor: SECONDARY_BORDER }}
          >
            <Text className='text-base font-semibold' style={{ color: SECONDARY_TEXT_COLOR }}>
              {SHARE_LABEL}
            </Text>
          </Pressable>

          {statusMessage ? <Text className='mt-4 text-center text-sm text-red-600'>{statusMessage}</Text> : null}
        </View>

        <View className='mt-auto pb-6 items-center'>
          <Pressable onPress={handleGenerateAnother}>
            <Text className='text-sm font-semibold text-slate-900'>{GENERATE_ANOTHER_LABEL}</Text>
          </Pressable>
          <Pressable className='mt-3' onPress={handleDashboard}>
            <Text className='text-sm text-slate-600'>{DASHBOARD_LABEL}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
