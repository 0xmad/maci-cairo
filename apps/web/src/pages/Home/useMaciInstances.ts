import { useCallback, useEffect, useState } from "react";

import { type MaciListItem } from "../../services/ops";
import { MACI_LIST_PAGE_SIZE, useMaciInstancesStore } from "../../stores/maciInstances";
import { useOperatorSession } from "../../stores/operatorSession";

export { MACI_LIST_PAGE_SIZE };

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
  const { items, pageCount, error, load, reset } = useMaciInstancesStore();
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (token === undefined) {
      reset();

      return;
    }

    load(token, page).catch(() => undefined);
  }, [token, page, refreshKey, load, reset]);

  const nextPage = useCallback((): void => {
    setPage((current) => (pageCount === 0 ? current : Math.min(pageCount, current + 1)));
  }, [pageCount]);

  const prevPage = useCallback((): void => {
    setPage((current) => Math.max(1, current - 1));
  }, []);

  return { signedIn, items, page, pageCount, error, nextPage, prevPage };
}
