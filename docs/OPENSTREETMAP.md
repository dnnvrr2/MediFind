# OpenStreetMap integration

The browser version embeds OpenStreetMap's interactive area map in the Change location dialog, pharmacy directory, and pharmacy details. Visitors can pan and zoom, preview a suggested area, and confirm it using Use this location. The selection continues to filter sample pharmacy listings. Changing the map viewport itself does not change the selected area or delivery address.

Predefined bounding boxes show approximate overviews of Cagayan de Oro City, Carmen, and Corrales Avenue. They are not pharmacy coordinates. No unverified pharmacy marker is displayed. For any other manually entered location, the app offers an OpenStreetMap search link instead of displaying an unrelated default map. Pharmacy address buttons also open OpenStreetMap search.

The native app opens OpenStreetMap in a browser through the shared map component. It does not embed a native map or WebView. Embedded browser maps include OpenStreetMap attribution, a larger-map link, and retry/external fallback when the frame fails or times out. Tile failures inside a loaded cross-origin frame cannot be detected by the app; the larger-map link remains available.

There is no API key, billing configuration, GPS request, or Nominatim integration. Typed place lookup uses Photon as described below. The embedded map uses OpenStreetMap's supplied export iframe. The map can be viewed at https://www.openstreetmap.org and its embed format is documented at https://wiki.openstreetmap.org/wiki/Export_tab. Attribution links point to https://www.openstreetmap.org/copyright. Before deploying at scale, review the current OpenStreetMap service policies and choose suitable map hosting for expected traffic.

Privacy information now explains that loading embedded maps makes requests to OpenStreetMap. No account information, prescriptions, or checkout address is passed to an embedded map.


## Listed and cached location selection

The picker opens with bundled Cagayan de Oro City, Carmen, and Corrales Avenue areas, plus saved place results. Typing filters this list instantly and makes no geocoder requests. There is no automatic map or iframe reload while typing. A map is mounted only after the visitor explicitly selects a result. Bundled points represent approximate area centers and are labeled accordingly.

Find more places online is an explicit fallback for missing places, using the configurable EXPO_PUBLIC_GEOCODER_URL Photon service. It retains cancellation, timeouts, and request spacing. Returned coordinates and names join the local list, with up to 50 valid results saved in browser tab session storage and a seven-day expiry. Native sessions keep results in memory. The online service and map tiles still require a network connection; caching names and points does not cache map imagery.

The default Photon demo permits reasonable prototype use without availability guarantees: https://github.com/komoot/photon. Use a hosted or self-hosted service for production load. No Nominatim autocomplete is used. Privacy text discloses the explicit search request and session caching. Account and prescription data are never sent to the map or place-search provider.
