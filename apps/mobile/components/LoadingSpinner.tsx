import { ActivityIndicator, View } from 'react-native';

const DEFAULT_SIZE = 'large';

export function LoadingSpinner(): JSX.Element {
  return (
    <View>
      <ActivityIndicator size={DEFAULT_SIZE} />
    </View>
  );
}
