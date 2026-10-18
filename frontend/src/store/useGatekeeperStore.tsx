import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import type {
  Action,
  CheckResponse,
  GraphResponse,
  LoadBearingItem,
  ReverseResponse,
} from '../api/types';

interface GatekeeperState {
  target: string;
  action: Action;
  depth: number;
  result: CheckResponse | null;
  shallowResult: CheckResponse | null;
  fullResult: CheckResponse | null;
  graph: GraphResponse | null;
  loadBearing: LoadBearingItem[];
  isChecking: boolean;
  isLoadingGraph: boolean;
  graphError: string | null;
  checkError: string | null;
  reverseInFlight: boolean;
  lastReverse: ReverseResponse | null;
  ripple: number;
  setTarget: (target: string) => void;
  setAction: (action: Action) => void;
  setDepth: (depth: number) => void;
  runCheck: (overrideDepth?: number) => Promise<CheckResponse>;
  runContrast: (fullDepth?: number) => Promise<void>;
  refreshGraph: () => Promise<void>;
  reverse: (old: string, newId: string, newTitle: string, dryRun: boolean) => Promise<ReverseResponse>;
  reset: () => Promise<void>;
}

const GatekeeperContext = createContext<GatekeeperState | null>(null);

export function GatekeeperProvider({ children }: { children: ReactNode }): JSX.Element {
  const [target, setTarget] = useState('file:compat/win7_shim.js');
  const [action, setAction] = useState<Action>('delete');
  const [depth, setDepth] = useState(6);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [shallowResult, setShallowResult] = useState<CheckResponse | null>(null);
  const [fullResult, setFullResult] = useState<CheckResponse | null>(null);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [loadBearing, setLoadBearing] = useState<LoadBearingItem[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [reverseInFlight, setReverseInFlight] = useState(false);
  const reverseLock = useRef(false);
  const [lastReverse, setLastReverse] = useState<ReverseResponse | null>(null);
  const [ripple, setRipple] = useState(0);

  const runCheck = useCallback(async (overrideDepth?: number): Promise<CheckResponse> => {
    setIsChecking(true);
    setCheckError(null);
    try { const response = await api.check({ target, action, depth: overrideDepth ?? depth }); setResult(response); return response; }
    catch (error) { setCheckError(error instanceof Error ? error.message : 'Checkpoint failed'); throw error; }
    finally { setIsChecking(false); }
  }, [action, depth, target]);

  const runContrast = useCallback(async (fullDepth?: number): Promise<void> => {
    setIsChecking(true);
    setCheckError(null);
    try { const [shallow, full] = await Promise.all([
      api.check({ target, action, depth: 1 }),
      api.check({ target, action, depth: Math.max(4, fullDepth ?? depth) }),
    ]);
    setShallowResult(shallow);
    setFullResult(full);
    setResult(depth === 1 ? shallow : full);
    } catch (error) { setCheckError(error instanceof Error ? error.message : 'Checkpoint failed'); throw error; }
    finally { setIsChecking(false); }
  }, [action, depth, target]);

  const refreshGraph = useCallback(async (): Promise<void> => {
    setIsLoadingGraph(true);
    setGraphError(null);
    try { const [nextGraph, nextLoadBearing] = await Promise.all([api.graph(), api.loadBearing(5)]); setGraph(nextGraph); setLoadBearing(nextLoadBearing); }
    catch (error) { setGraphError(error instanceof Error ? error.message : 'Graph request failed'); throw error; }
    finally { setIsLoadingGraph(false); }
  }, []);

  const reverse = useCallback(async (old: string, newId: string, newTitle: string, dryRun: boolean): Promise<ReverseResponse> => {
    if (reverseLock.current) throw new Error('A reversal is already in progress');
    reverseLock.current = true;
    setReverseInFlight(true);
    try {
      const response = await api.reverse({ old, new_id: newId, new_title: newTitle, dry_run: dryRun });
      setLastReverse(response);
      if (!dryRun) {
        setRipple((value) => value + 1);
        await refreshGraph();
        await runContrast();
      }
      return response;
    } finally { reverseLock.current = false; setReverseInFlight(false); }
  }, [refreshGraph, runContrast]);

  const reset = useCallback(async (): Promise<void> => {
    await api.reset();
    setLastReverse(null);
    setShallowResult(null);
    setFullResult(null);
    setRipple((value) => value + 1);
    await refreshGraph();
    await runCheck();
  }, [refreshGraph, runCheck]);

  const value = useMemo(() => ({
    target, action, depth, result, shallowResult, fullResult, graph, loadBearing, isChecking, isLoadingGraph, graphError, checkError, reverseInFlight,
    lastReverse, ripple, setTarget, setAction, setDepth, runCheck, runContrast, refreshGraph, reverse, reset,
  }), [action, checkError, depth, fullResult, graph, graphError, isChecking, isLoadingGraph, lastReverse, loadBearing, refreshGraph, reset, result, reverse, reverseInFlight, ripple, runCheck, runContrast, shallowResult, target]);

  return <GatekeeperContext.Provider value={value}>{children}</GatekeeperContext.Provider>;
}

export function useGatekeeperStore(): GatekeeperState {
  const context = useContext(GatekeeperContext);
  if (!context) throw new Error('useGatekeeperStore must be used within GatekeeperProvider');
  return context;
}
