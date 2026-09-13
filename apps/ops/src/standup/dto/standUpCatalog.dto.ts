/** Catalog Circuit profile: name and derived capacity. */
export class CircuitProfileCatalogDto {
  id!: string;

  maxSignups!: number;

  maxVoteOptions!: number;
}

/** Catalog Policy or vote-balance assigner choice. */
export class StandUpChoiceDto {
  id!: string;
}

/** Operator stand-up catalog from `GET /standup`. */
export class StandUpCatalogDto {
  circuitProfiles!: CircuitProfileCatalogDto[];

  policies!: StandUpChoiceDto[];

  assigners!: StandUpChoiceDto[];
}
