import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

type IoniconName = keyof typeof Ionicons.glyphMap;

const TEMPLATE_SINGULAR = 'template';
const TEMPLATE_PLURAL = 'templates';
const TEMPLATE_SINGULAR_COUNT = 1;
const DEFAULT_ICON_NAME: IoniconName = 'folder-outline';
const ICON_COLOR = '#0F172A';
const ICON_SIZE = 24;
const SHADOW_OPACITY = 0.08;
const SHADOW_RADIUS = 8;
const SHADOW_OFFSET_X = 0;
const SHADOW_OFFSET_Y = 4;
const SHADOW_ELEVATION = 3;

interface CategoryCardProps {
  icon: string;
  name: string;
  templateCount: number;
  onPress: () => void;
}

function isIoniconName(name: string): name is IoniconName {
  return name in Ionicons.glyphMap;
}

export function CategoryCard({ icon, name, templateCount, onPress }: CategoryCardProps): JSX.Element {
  const iconName = isIoniconName(icon) ? icon : DEFAULT_ICON_NAME;
  const templateLabel = templateCount === TEMPLATE_SINGULAR_COUNT ? TEMPLATE_SINGULAR : TEMPLATE_PLURAL;

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
      <View className='h-10 w-10 items-center justify-center rounded-xl bg-slate-100'>
        <Ionicons name={iconName} size={ICON_SIZE} color={ICON_COLOR} />
      </View>
      <Text className='mt-3 text-base font-semibold text-slate-900'>{name}</Text>
      <Text className='mt-1 text-xs text-slate-500'>
        {templateCount} {templateLabel}
      </Text>
    </Pressable>
  );
}
