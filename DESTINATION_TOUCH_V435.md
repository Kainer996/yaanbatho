# Destination map taps and routing recovery — v435

Build/cache: `destination-touch-v435-20260921`; based on PR376 (`0e7b35d2`).

The published planner saved coordinates but supplied no visible marker until routing succeeded. Its selection switch enabled pan while ordinary GPS-follow and single-finger rotation still ran. Provider failures also surfaced raw `provider-http` messages and left players unable to begin.

The fix places large red numbered START/DESTINATION markers immediately at the selected geographic point, keeps the map available for consecutive start/destination taps, and gives planning ownership of pan/GPS behavior until closed. Manual coordinate entry and precise GPS remain available. A route preview never moves the selected markers to snapped route vertices.

After the first Overpass failure, small searches (at most4 square kilometres including margin) can read the official OSM map API. The adapter joins ways to explicitly supplied node coordinates; it preserves node IDs, barriers/access tags and restriction relations and uses the same route validator. It neither invents path edges nor substitutes a straight-line route. Large searches retain bounded Overpass fallbacks. Successful public data has a two-entry, five-minute memory cache; no backend, credentials or stored player data are added. Timeout cancellation is distinguished from a user cancellation. Failures keep both selections and explain retry; Begin remains unavailable until a real validated route and reward plan are ready.

Provider diagnosis used fixed public Hyde Park points. The configured services reproduced network failure,429 and504 responses. A real official OSM map response produced a207m/12-point route that passed existing canonical validation. The OSM JSON map API represents way geometry through explicit node references: https://wiki.openstreetmap.org/wiki/API_v0.6#Retrieving_map_data_by_bounding_box:_GET_/api/0.6/map . Provider availability remains external; no always-online guarantee is made.

Focused checks:11 route,12 state,8 UI/lifecycle,5 recovery groups; exact consuming and three-worker-list pins for all three changed modules/styles, executable inline syntax and diff whitespace. Native touch/real-provider/Begin evidence and publication result are recorded in the owner release output. Testing uses a disposable phone-emulated Chromium profile with fixed public GPS and bounded basemap tiles, not a physical outdoor walk.
