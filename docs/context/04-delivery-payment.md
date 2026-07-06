# 04 — Delivery & Payment

## Delivery Zone System

```
Nepal zones (seeded):
  KTM    → Kathmandu, Lalitpur, Bhaktapur (inside_valley)
  PKR    → Kaski / Pokhara
  BRT    → Morang, Sunsari / Biratnagar
  CTW    → Chitwan / Bharatpur
  BTW    → Rupandehi / Butwal
  REMOTE → Humla, Dolpa, Mustang, Mugu

Delivery charges:
  inside_valley  → NPR 0   (free delivery in KTM valley)
  outside_valley → NPR 100
  remote         → NPR 200
```

## Serviceability Check Flow

```
POST /delivery/check { destPincode, shopId, sizeClass }

Step 1: pincode → zoneId
  SELECT zone_id FROM pincode_zone_map WHERE pincode = $1
  (O(1) — PK lookup)
  → Not found: return { result: 'unserviceable' }

Step 2: shop default warehouse → originZoneId
  → No warehouse configured: use KTM as default

Step 3: Check cache (24h TTL)
  SELECT * FROM delivery_serviceability_cache
  WHERE origin_zone_id=$1 AND dest_zone_id=$2 AND size_class=$3
    AND expires_at > NOW()
  → Cache hit: return { ...result, fromCache: true }

Step 4: Query active carriers
  SELECT * FROM carrier_zone_routes
  WHERE origin_zone_id=$1 AND dest_zone_id=$2 AND is_active=true
  → No carriers: { result: 'unserviceable' }
  → Carriers found: build response

Step 5: Write to cache (upsert, 24h TTL)
  → Next identical request served from cache in ~1ms
```

## Payment Methods

| Method | Flow |
|--------|------|
| **COD** | Customer pays on delivery. Order placed immediately. |
| **eSewa** | Customer pays via eSewa. Admin enters transaction reference manually in `paymentReference`. Admin then updates `paymentStatus = 'paid'`. |
| **Fonepay** | Same as eSewa — manual reference entry by admin. |

> **Phase 2**: eSewa and Fonepay will be integrated via their payment gateway APIs with webhook callbacks for automatic payment confirmation.
