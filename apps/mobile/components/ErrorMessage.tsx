import { Text, View } from 'react-native';

interface ErrorMessageProps {
  message?: string;
}

const DEFAULT_MESSAGE = 'Something went wrong';

export function ErrorMessage({ message = DEFAULT_MESSAGE }: ErrorMessageProps): JSX.Element {
  return (
    <View>
      <Text>{message}</Text>
    </View>
  );
}
