# BlueBand LiDAR event import

BlueBand units use the existing `EventLogUtility log` command and its normal device discovery, batching, download, decode, and archive workflows. There is no separate BlueBand command or scheduler.

Configure each unit as an enabled ATSPM device with:

- `DeviceType`: `LidarSensor`
- `Protocol`: `Http`
- `Port`: `8088`
- `Path`: `/api/app/spm+/events`
- `Query`: `["?start=[LogStartTime:yyyy-MM-ddTHH:mm:ss]&end=[DateTime:yyyy-MM-ddTHH:mm:ss]&q=state"]`
- `LoggingOffset`: the number of minutes requested in each run (120 matches the validated reference pulls)
- `Decoders`: `["BluebandLidarEventDecoder"]`
- `ConnectionProperties`: add `Authorization` with value `bearer <token>`

The existing configuration UI exposes connection properties as key/value rows. This is the preferred token mapping because the configuration database allows up to 1024 characters for the combined property JSON, while its legacy `Password` field is limited to 50 characters. For shorter tokens, `Password` remains a supported fallback: the adapter copies it to the HTTP `Authorization: bearer ...` header and never places it in the request URI. An explicit `Authorization` connection property always takes precedence; `Accept: application/json` is added when absent.

`BluebandLidarDownloader` is registered beside `DeviceDownloader` in the Event Log Utility. Their selection predicates are intentionally disjoint: only HTTP LiDAR devices configured with `BluebandLidarEventDecoder` use the BlueBand adapter, while existing devices continue through the generic downloader.

## Payload-size validation

The adapter measures the completed JSON file with `FileInfo.Length` before the shared importer loads it into memory. It logs the measured byte count and rejects and removes files outside the configured inclusive range:

- `DeviceDownloaderConfiguration__BluebandLidarDownloader__MinimumFileSizeBytes` (default `2`)
- `DeviceDownloaderConfiguration__BluebandLidarDownloader__MaximumFileSizeBytes` (default `134217728`, or 128 MiB; values below `1` disable the upper limit)

The default upper bound is above the approximately 12 MB two-hour sample files in the reference data while preventing an unexpectedly large response from reaching the in-memory decoder.
