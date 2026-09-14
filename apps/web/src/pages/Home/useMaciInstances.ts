import { useCallback, useEffect, useState } from "react";

import { opsBaseUrl } from "../../config/ops";
import { OpsClient, type MaciListItem } from "../../services/ops";
import { useOperatorSession } from "../../stores/operatorSession";

export const MACI_LIST_PAGE_SIZE = 10;

export interface UseMaciInstancesResult {
  signedIn: boolean;
  items: MaciListItem[];
  page: number;
  pageCount: number;
  error?: string;
  nextPage: () => void;
  prevPage: () => void;
}

export function useMaciInstances(refreshKey?: string): UseMaciInstancesResult {
  const token = useOperatorSession((session) => session.token);
  const signedIn = token !== undefined;
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<MaciListItem[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (token === undefined) {
      setItems([]);
      setPageCount(0);
      setError(undefined);

      return undefined;
    }

    const client = new OpsClient(opsBaseUrl());
    let cancelled = false;

    client
      .listMacis(token, page, MACI_LIST_PAGE_SIZE)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setItems(result.items);
        setPageCount(result.total === 0 ? 0 : Math.ceil(result.total / result.pageSize));
        setError(undefined);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "MACI list failed");
        }
      });

    return (): void => {
      cancelled = true;
    };
  }, [token, page, refreshKey]);

  const nextPage = useCallback((): void => {
    setPage((current) => (pageCount === 0 ? current : Math.min(pageCount, current + 1)));
  }, [pageCount]);

  const prevPage = useCallback((): void => {
    setPage((current) => Math.max(1, current - 1));
  }, []);

  return { signedIn, items, page, pageCount, error, nextPage, prevPage };
}
