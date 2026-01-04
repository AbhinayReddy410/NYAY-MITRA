import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

const CLOCK_ICON_NAME = 'time-outline';
const CHEVRON_ICON_NAME = 'chevron-forward';
const ICON_COLOR = '#0F172A';
const SUBTEXT_COLOR = '#64748B';
const ICON_SIZE = 18;
const CHEVRON_SIZE = 20;
const SHADOW_OPACITY = 0.08;
const SHADOW_RADIUS = 8;
const SHADOW_OFFSET_X = 0;
const SHADOW_OFFSET_Y = 4;
const SHADOW_ELEVATION = 3;
const MINUTES_LABEL = 'min';
const MAX_DESCRIPTION_LINES = 2;

interface TemplateCardProps {
  name: string;
  description: string;
  estimatedMinutes: number;
  onPress: () => void;
}

export function TemplateCard({
  name,
  description,
  estimatedMinutes,
  onPress
}: TemplateCardProps): JSX.Element {
  return (
    <Pressable
      className='rounded-2xl bg-white p-4'
      onPress={onPress}
      style={{
        shadowColor: ICON_COLOR,
        shadowOpacity: SHADOW_OPACITY,
        shadowRadius: SHADOW_RADIUS,
        shadowOffset: { width: SHADOW_OFFSET_X, height: SHADOW_OFFSET_Y },
        elevation: SHADOW_ELEVATION
      }}
    >
      <View className='flex-row items-start justify-between'>
        <View className='flex-1 pr-3'>
          <Text className='text-base font-semibold text-slate-900'>{name}</Text>
          <Text className='mt-1 text-sm text-slate-500' numberOfLines={MAX_DESCRIPTION_LINES}>
            {description}
          </Text>
          <View className='mt-3 flex-row items-center'>
            <Ionicons name={CLOCK_ICON_NAME} size={ICON_SIZE} color={SUBTEXT_COLOR} />
            <Text className='ml-2 text-xs text-slate-500'>
              {estimatedMinutes} {MINUTES_LABEL}
            </Text>
          </View>
        </View>
        <Ionicons name={CHEVRON_ICON_NAME} size={CHEVRON_SIZE} color={ICON_COLOR} />
      </View>
    </Pressable>
  );
}
