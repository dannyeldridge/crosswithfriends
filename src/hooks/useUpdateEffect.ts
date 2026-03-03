import {useEffect, useRef, type DependencyList, type EffectCallback} from 'react';

/** Like useEffect, but skips the initial mount — only runs on dependency updates. */
export function useUpdateEffect(effect: EffectCallback, deps: DependencyList) {
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return undefined;
    }
    return effect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
