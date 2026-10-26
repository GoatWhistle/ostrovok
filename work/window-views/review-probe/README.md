# Isolated review probe

Historical round1 Isaac/Angleterre visible-facade evidence, not a new room guarantee.
One claim, same partial/guaranteed=false wording, exact captured source data.

- output.txt ran against the externally replaced root-source container51e66040,
  not the frozen13bcbe8 evaluator. It returned unsupported with a grounded quote.
- frozen-output.txt ran with immutable image5b9158cc (source13bcbe8) and existing
  configured model. It returned supported=true with a grounded quote. This is one
  diagnostic sample, not proof of why earlier batches were rejected.
- input.json uses historical API fact shape, not a captured rejected batch's exact
  flattened recommendation_claim schema. Next diagnosis must capture actual candidates.

Neither invocation is counted in the50-query stand evaluation. No credentials captured.

## Current candidate capture

capture_candidates.py runs source13bcbe8 against current DB/DEM/geometry cache in an
isolated container. Parser fixed to explicit Isaac view, fake planner; no model calls.
Review replaced with a recorder rejecting every row before facts are saved.
First attempt specified wrong OSM building=cathedral type and found no target; preserved
as incorrect-type-* (not valid evidence). Removing that incorrect extra type constraint
resolved physical cathedralr3229838 and produced36 candidates,4 positive facade estimates.
current-candidates.json contains the actual recommendation_claim shapes from this replay;
it is NOT the exact historical batch sent during round3.

batch-input.json/ batch-output.txt: first12 captured rows, frozen old verifier settings;
model after retry approved all12, quoting the wish label rather than measured evidence.
eligible-input.json/eligible-output.txt:4 positive candidates after deterministic filtering,
new verification mode (temperature0,4000 tokens). All4 approved with grounded quotes of
visibility.status=visible and bookable_room_confirmed=false. Two variables changed;
this is combined-behavior evidence, not a causal estimate of temperature alone.
independent-rays.json independently reconstructs the four sampled profiles;0 violations,
all targetr3229838. This validates computed facades, not actual bookable room inventory.
