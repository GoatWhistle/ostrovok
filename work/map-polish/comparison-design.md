# Comparison implementation

Use the existing Factmap cobalt actions, lime evidence highlights, neutral surfaces and Manrope type tokens. Full-width horizontal hotel columns with a shared subgrid for aligned facts; the left edge of every cell carries its own characteristic name so mobile scrolling keeps context. At 375px show one card and the edge of the next, with scroll snapping. At desktop fit two columns comfortably and allow horizontal scrolling for five without shrinking readable text.

The toolbar shows differing/total counts and a pressed toggle. Hotel identity remains visible when matrix loading fails. Each header has the real thumbnail or building icon, name, stars/address if supplied, cached search match score if available, removal and optional date-driven offers. Never infer prices or ordered benefits. Facts are grouped and ranked by registry metadata; arbitrary properties keep an explicit other group. Missing facts explain unavailable evidence. Fact inspection is composed by the compare page using the existing FactDetails feature in a shared native dialog.

Edge checks: 2/5 actual hotels, longest stored names, absent photos/address/prices, missing cells and facility lists, partial API failures, both locales/themes at 375/1440. Synthetic worst-case responses stay only in browser tests. Immediate screen corrections are authorized by the implementation request.
