import {useCallback, useState} from 'react';

/** Boolean state with a toggle function. Optionally pass a value to set directly. */
export function useToggle(initialValue: boolean): [boolean, (nextValue?: boolean) => void] {
  const [value, setValue] = useState(initialValue);
  const toggle = useCallback((nextValue?: boolean) => {
    setValue((prev) => (typeof nextValue === 'boolean' ? nextValue : !prev));
  }, []);
  return [value, toggle];
}
