import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

interface DraftHistoryItemProps {
  templateName: string;
  categoryName: string;
  createdAt: string;
  isDownloading: boolean;
  isDeleting: boolean;
  onDownload: () => void;
  onDelete: () => void;
}

const DOWNLOAD_ICON_NAME = 'download-outline';
const DELETE_ICON_NAME = 'trash-outline';
const ICON_COLOR = '#0F172A';
const MUTED_TEXT = '#64748B';
const LIGHT_TEXT = '#94A3B8';
const ICON_SIZE = 20;
const ACTION_SIZE = 36;
const ACTION_SPINNER_SIZE = 'small';
const ACTION_BACKGROUND = '#F1F5F9';

const GENERATED_PREFIX = 'Generated';
const TIME_FALLBACK = 'just now';

function formatRelativeTime(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return TIME_FALLBACK;
  }
  return formatDistanceToNow(new Date(parsed), { addSuffix: true });
}

export function DraftHistoryItem({
  templateName,
  categoryName,
  createdAt,
  isDownloading,
  isDeleting,
  onDownload,
  onDelete
}: DraftHistoryItemProps): JSX.Element {
  const relativeTime = useMemo((): string => formatRelativeTime(createdAt), [createdAt]);
  const isDownloadDisabled = isDownloading || isDeleting;
  const isDeleteDisabled = isDeleting || isDownloading;

  return (
    <View className='flex-row items-center justify-between rounded-2xl bg-white p-4'>
      <View className='flex-1 pr-4'>
        <Text className='text-base font-semibold text-slate-900'>{templateName}</Text>
        <Text className='mt-1 text-xs' style={{ color: MUTED_TEXT }}>
          {categoryName}
        </Text>
        <Text className='mt-2 text-xs' style={{ color: LIGHT_TEXT }}>
          {GENERATED_PREFIX} {relativeTime}
        </Text>
      </View>
      <View className='flex-row items-center'>
        <Pressable
          className='items-center justify-center rounded-full'
          disabled={isDownloadDisabled}
          onPress={onDownload}
          style={{ backgroundColor: ACTION_BACKGROUND, height: ACTION_SIZE, width: ACTION_SIZE }}
        >
          {isDownloading ? (
            <ActivityIndicator size={ACTION_SPINNER_SIZE} color={ICON_COLOR} />
          ) : (
            <Ionicons color={ICON_COLOR} name={DOWNLOAD_ICON_NAME} size={ICON_SIZE} />
          )}
        </Pressable>
        <Pressable
          className='ml-2 items-center justify-center rounded-full'
          disabled={isDeleteDisabled}
          onPress={onDelete}
          style={{ backgroundColor: ACTION_BACKGROUND, height: ACTION_SIZE, width: ACTION_SIZE }}
        >
          {isDeleting ? (
            <ActivityIndicator size={ACTION_SPINNER_SIZE} color={ICON_COLOR} />
          ) : (
            <Ionicons color={ICON_COLOR} name={DELETE_ICON_NAME} size={ICON_SIZE} />
          )}
        </Pressable>
      </View>
    </View>
  );
}
