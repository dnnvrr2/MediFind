# OpenStreetMap integration

Browser maps appear on pharmacy details, order tracking, and the rider's delivery details. Change location and the pharmacy directory are map-free. The picker keeps its instant CDO list and device location detection; confirmation changes the browsing area, not the checkout address.

Destination maps derive an approximate CDO barangay or city area locally from the saved destination. A barangay marker represents an approximate area point, not a verified doorstep or pharmacy coordinate. Maps explicitly indicate that live rider location is unavailable. Missing or outside-CDO locations offer a user-triggered address search rather than showing the browsing location or an unrelated map. Rider delivery details show the pharmacy map before pickup or during return, and the destination map after pickup. They do not calculate a route or ETA.

The native app opens OpenStreetMap in a browser through the shared map component. It does not embed a native map or WebView. Embedded browser maps include OpenStreetMap attribution, a larger-map link, and retry/external fallback when the frame fails or times out. Tile failures inside a loaded cross-origin frame cannot be detected by the app; the larger-map link remains available.

Maps require no API key or billing configuration and do not request GPS. Device location is requested separately, only through Use my location. No Nominatim integration is used. The location picker uses local filtering only; it makes no online place-search requests. The embedded map uses OpenStreetMap's supplied export iframe. The map can be viewed at https://www.openstreetmap.org and its embed format is documented at https://wiki.openstreetmap.org/wiki/Export_tab. Attribution links point to https://www.openstreetmap.org/copyright. Before deploying at scale, review the current OpenStreetMap service policies and choose suitable map hosting for expected traffic.

Privacy information now explains that loading embedded maps makes requests to OpenStreetMap. Embedded maps receive only an approximate public area viewport and optional barangay point. Full delivery addresses are sent to OpenStreetMap only when the user opens an address search.


## Listed and cached location selection

The picker includes all 80 CDO barangays, city/sample areas, and saved place results. Typing filters this list locally. No map or iframe is mounted in the picker, including after selection or device detection. Detected barangay and accuracy are shown as text for confirmation.

The Search online button and keyboard-triggered online search have been removed. The picker filters bundled areas and previously cached valid places only. Device location detection still resolves the barangay locally. The existing Photon helper is retained in source but is not called by the picker. Map imagery on other screens still requires an internet connection.
