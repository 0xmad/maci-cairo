import { useCallback, useEffect, useState } from "react";

import { type PollListItem } from "../../services/ops";
import { useOperatorSession } from "../../stores/operatorSession";
import { POLL_LIST_PAGE_SIZE, usePollsStore } from "../../stores/polls";

export { POLL_LIST_PAGE_SIZE };

export interface UsePollsResult {
  signedIn: boolean;
  items: PollListItem[];
  page: number;
  pageCount: number;
  error?: string;
  nextPage: () => void;
  prevPage: () => void;
}

export function usePolls(maci?: string): UsePollsResult {
  const token = useOperatorSession((session) => session.token);
  const signedIn = token !== undefined;
  const { items, pageCount, error, load, reset } = usePollsStore();
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (token === undefined || maci === undefined || maci.length === 0) {
      reset();

      return;
    }

    load(token, maci, page).catch(() => undefined);
  }, [token, maci, page, load, reset]);

  const nextPage = useCallback((): void => {
    setPage((current) => (pageCount === 0 ? current : Math.min(pageCount, current + 1)));
  }, [pageCount]);

  const prevPage = useCallback((): void => {
    setPage((current) => Math.max(1, current - 1));
  }, []);

  return { signedIn, items, page, pageCount, error, nextPage, prevPage };
}
