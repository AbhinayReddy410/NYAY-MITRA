import { Text, View } from 'react-native';

interface EmptyStateProps {
  message?: string;
}

const DEFAULT_MESSAGE = 'No data available';

export function EmptyState({ message = DEFAULT_MESSAGE }: EmptyStateProps): JSX.Element {
  return (
    <View>
      <Text>{message}</Text>
    </View>
  );
}
