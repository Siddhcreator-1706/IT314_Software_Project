# S3-13 EXPLAIN report

Rows visible to the planner: incidents=25, TEAM resources=86

## public incidents: no filter

Execution time: 2.175 ms. Findings: sequential scan on a large table.

```
Limit  (cost=11.01..11.02 rows=1 width=417) (actual time=2.133..2.136 rows=19.00 loops=1)
  Buffers: shared hit=25 read=3 dirtied=1
  ->  Sort  (cost=11.01..11.02 rows=1 width=417) (actual time=2.132..2.133 rows=19.00 loops=1)
        Sort Key: verified_at DESC NULLS LAST
        Sort Method: quicksort  Memory: 27kB
        Buffers: shared hit=25 read=3 dirtied=1
        ->  Seq Scan on incidents i  (cost=0.00..11.00 rows=1 width=417) (actual time=1.348..2.089 rows=19.00 loops=1)
              Filter: ((verified_by IS NOT NULL) AND (latitude IS NOT NULL) AND (longitude IS NOT NULL) AND ((canonical_incident_id IS NULL) OR (canonical_incident_id = incident_id)) AND (status = ANY ('{VERIFIED,DISPATCHED,RESOLVED}'::incident_status[])))
              Rows Removed by Filter: 6
              Buffers: shared hit=22 read=3 dirtied=1
Planning:
  Buffers: shared hit=81 read=4 dirtied=1
Planning Time: 2.556 ms
Execution Time: 2.175 ms
```

## public incidents: district=Surat

Execution time: 0.054 ms. Findings: sequential scan on a large table.

```
Limit  (cost=11.31..11.32 rows=1 width=417) (actual time=0.030..0.030 rows=2.00 loops=1)
  Buffers: shared hit=2
  ->  Sort  (cost=11.31..11.32 rows=1 width=417) (actual time=0.029..0.029 rows=2.00 loops=1)
        Sort Key: verified_at DESC NULLS LAST
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=2
        ->  Seq Scan on incidents i  (cost=0.00..11.30 rows=1 width=417) (actual time=0.018..0.024 rows=2.00 loops=1)
              Filter: ((verified_by IS NOT NULL) AND (latitude IS NOT NULL) AND (longitude IS NOT NULL) AND ((canonical_incident_id IS NULL) OR (canonical_incident_id = incident_id)) AND (status = ANY ('{VERIFIED,DISPATCHED,RESOLVED}'::incident_status[])) AND (lower((district)::text) = 'surat'::text))
              Rows Removed by Filter: 23
              Buffers: shared hit=2
Planning Time: 0.143 ms
Execution Time: 0.054 ms
```

## public incidents: scenario=cyclone

Execution time: 0.777 ms. Findings: none.

```
Limit  (cost=8.20..8.21 rows=1 width=417) (actual time=0.750..0.751 rows=3.00 loops=1)
  Buffers: shared hit=2 read=1
  ->  Sort  (cost=8.20..8.21 rows=1 width=417) (actual time=0.749..0.750 rows=3.00 loops=1)
        Sort Key: verified_at DESC NULLS LAST
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=2 read=1
        ->  Index Scan using idx_incidents_scenario on incidents i  (cost=0.14..8.19 rows=1 width=417) (actual time=0.738..0.742 rows=3.00 loops=1)
              Index Cond: (scenario = 'CYCLONE'::scenario_type)
              Filter: ((verified_by IS NOT NULL) AND (latitude IS NOT NULL) AND (longitude IS NOT NULL) AND ((canonical_incident_id IS NULL) OR (canonical_incident_id = incident_id)) AND (status = ANY ('{VERIFIED,DISPATCHED,RESOLVED}'::incident_status[])))
              Rows Removed by Filter: 1
              Index Searches: 1
              Buffers: shared hit=2 read=1
Planning Time: 0.138 ms
Execution Time: 0.777 ms
```

## public incidents: Ahmedabad bbox

Execution time: 0.872 ms. Findings: none.

```
Limit  (cost=8.20..8.20 rows=1 width=417) (actual time=0.823..0.824 rows=2.00 loops=1)
  Buffers: shared hit=26 read=1
  ->  Sort  (cost=8.20..8.20 rows=1 width=417) (actual time=0.822..0.823 rows=2.00 loops=1)
        Sort Key: verified_at DESC NULLS LAST
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=26 read=1
        ->  Index Scan using idx_incidents_geom on incidents i  (cost=0.14..8.19 rows=1 width=417) (actual time=0.812..0.816 rows=2.00 loops=1)
              Index Cond: (geom && '0103000020E61000000100000005000000CDCCCCCCCC1C52403333333333F33640CDCCCCCCCC1C52409A99999999193740CDCCCCCCCC2C52409A99999999193740CDCCCCCCCC2C52403333333333F33640CDCCCCCCCC1C52403333333333F33640'::geography)
              Filter: ((verified_by IS NOT NULL) AND (latitude IS NOT NULL) AND (longitude IS NOT NULL) AND ((canonical_incident_id IS NULL) OR (canonical_incident_id = incident_id)) AND (status = ANY ('{VERIFIED,DISPATCHED,RESOLVED}'::incident_status[])))
              Rows Removed by Filter: 1
              Index Searches: 1
              Buffers: shared hit=26 read=1
Planning:
  Buffers: shared hit=3 read=3 dirtied=2
Planning Time: 5.049 ms
Execution Time: 0.872 ms
```

## team recommendations (Ahmedabad point)

Execution time: 43.004 ms. Findings: sequential scan on a large table.

```
Sort  (cost=1072.91..1073.12 rows=85 width=193) (actual time=42.932..42.938 rows=86.00 loops=1)
  Sort Key: (round(((st_distance((r.current_geom)::geography, '0101000020E6100000CD3B4ED191245240F6285C8FC2053740'::geography, true) / '1000'::double precision))::numeric, 1))
  Sort Method: quicksort  Memory: 45kB
  Buffers: shared hit=262 read=19 dirtied=4
  ->  Hash Join  (cost=1.25..1070.18 rows=85 width=193) (actual time=42.685..42.879 rows=86.00 loops=1)
        Hash Cond: (r.agency_id = a.agency_id)
        Buffers: shared hit=259 read=19 dirtied=4
        ->  Seq Scan on resources r  (cost=0.00..5.49 rows=85 width=231) (actual time=0.013..0.044 rows=86.00 loops=1)
              Filter: ((quantity_available > '0'::numeric) AND (type = 'TEAM'::resource_type) AND (status = 'AVAILABLE'::resource_status))
              Buffers: shared hit=4
        ->  Hash  (cost=1.11..1.11 rows=11 width=59) (actual time=0.011..0.012 rows=11.00 loops=1)
              Buckets: 1024  Batches: 1  Memory Usage: 9kB
              Buffers: shared hit=1
              ->  Seq Scan on agencies a  (cost=0.00..1.11 rows=11 width=59) (actual time=0.006..0.007 rows=11.00 loops=1)
                    Buffers: shared hit=1
Planning:
  Buffers: shared hit=184 read=7 dirtied=4
Planning Time: 4.845 ms
Execution Time: 43.004 ms
```

