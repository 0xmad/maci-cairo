import { type SyntheticEvent, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface UseMaciPageResult {
  address?: string;
  draft: string;
  handleChange: (event: SyntheticEvent<HTMLInputElement>) => void;
  handleSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  hasMaci: boolean;
}

export function useMaciPage(): UseMaciPageResult {
  const { address } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(address ?? "");
  const hasMaci = address !== undefined && address.length > 0;

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const next = draft.trim();

    if (next.length === 0) {
      return;
    }

    navigate(`/maci/${next}`);
  };

  const handleChange = (event: SyntheticEvent<HTMLInputElement>): void => {
    setDraft(event.currentTarget.value);
  };

  return { address, draft, handleChange, handleSubmit, hasMaci };
}
