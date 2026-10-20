# Public screens

Guests can use Home, Search, Pharmacies, medicine details, availability, and pharmacy details without signing in. The public tab bar shows Home, Search, Pharmacies, and Login; customer and rider navigation stay distinct.

Home follows the public reference with a teal search banner and pharmacy/prescription entry cards. All catalog data remains explicitly marked as sample data. The pharmacy directory supports manual area/name filtering; unsupported areas produce a clear empty state. No live location permission is requested, and no distances or inventory timestamps are invented. Valid pharmacy addresses open external map search; phone calls are offered only for usable phone numbers.

Customer routes (cart, checkout, prescriptions, orders, profile editing) require sign-in, including direct links. Browsing pharmacy availability remains public. Selecting Add to cart as a guest preserves the medicine, pharmacy, and quantity in a validated internal return link. Sign-in and registration resume that selection after success; adding the item still requires the customer's explicit action. Upload links resume prescription upload after authentication. API ownership checks remain responsible for protecting saved customer data.

Authentication screens include field validation, password visibility, password confirmation, and submission loading protection. The password rule remains a minimum of eight characters. Registration creates customer accounts only. Forgot password keeps the current return destination when returning to sign-in.

Search retains query/filter route parameters and saves scroll position per query/filter for return navigation. Help, Privacy, and Terms are available at the bottom of the customer, rider, and admin Profile screens; policy content is clearly a draft until the operator supplies identity, support, retention/deletion, and applicable service terms.

## Validation

TypeScript checking, the frontend domain tests (including public-route protection and internal redirect validation), and the production web export pass locally. Interactive browser review could not run because browser use is disabled in Work settings. Mobile device/camera and real authentication handoff still require interactive validation against a configured API. Nothing has been published or pushed.

The root URL `/` always renders the guest landing and public navigation, even when an account session is restored. Customer Home is `/home`, requires sign-in, and is the default destination after sign-in or registration. Explicit return links still resume the intended customer action.

The home search banner uses a larger two-line heading, readable supporting copy, a contrasting white search button, and quieter popular-search chips. Change location opens a manual city/barangay/street selector with sample-area suggestions. The selected area filters Home pharmacy cards, the pharmacy directory, and medicine availability. Unsupported areas show an empty state. The area is kept in app state and web tab session storage, separately from the checkout delivery address. Use my location supports foreground device detection within CDO. The picker has no map; maps appear on pharmacy details, order tracking, and rider delivery details. Live inventory and rider GPS tracking remain unavailable.

Mobile popular-search chips stay on one horizontal row, with scrolling available on narrow screens. Navigation labels use one line and the same weight in active/inactive states to prevent Prescriptions wrapping when selected. The global Help/Privacy/Terms footer has been removed.
