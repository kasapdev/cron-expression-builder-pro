# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.1] - 2026-09-06

### Fixed

- Day-of-week picker misrepresenting the cron alias `7` (Sunday) as `6`
  (Saturday). The parser correctly treats `7` as an alias for `0` in the
  day-of-week field (standard cron behavior), but syncing a raw expression
  like `0 9 * * 7` into the visual picker clamped the "Specific" mode value
  to `6` instead of normalizing it to `0` first. Beyond the picker showing
  the wrong day, this could silently corrupt the raw expression itself the
  next time any picker control was touched, turning a Sunday schedule into
  a Saturday schedule. The value is now normalized before clamping.
