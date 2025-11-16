# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-11-16

### Added
- Initial release
- WebSocket data collection from multiple sources
- Support for Bwin and SofaScore collectors
- Event processing engine with rule-based logic
- Telegram notification system
- Real-time alerts for:
  - Goals (with scorer, assist, penalty/own goal info)
  - Red cards
  - Yellow cards
- Performance monitoring and logging
- Auto-reconnection on connection loss
- Event deduplication system
- Modular architecture
- Docker and Docker Compose support
- Comprehensive documentation
- Configuration via environment variables
- Custom rule system for alerts
- Performance optimization (< 50ms processing, < 200ms delivery)

### Architecture
- BaseCollector for extensible WebSocket connections
- EventProcessor for business logic
- TelegramNotifier for alert delivery
- Utility modules for logging, config, validation, and performance

### Documentation
- Complete README with examples
- API documentation
- Deployment guide for multiple platforms
- Telegram setup guide

### Performance
- Sub-50ms event processing overhead
- Sub-200ms Telegram message delivery
- Efficient event caching and deduplication
- Optimized WebSocket handling

---

## Future Releases

### [1.1.0] - Planned
- [ ] Support for additional bookmakers (Bet365, William Hill)
- [ ] Corners and shots tracking
- [ ] Dangerous attacks monitoring
- [ ] Advanced statistics

### [1.2.0] - Planned
- [ ] Web dashboard for monitoring
- [ ] Historical data storage
- [ ] REST API for integrations
- [ ] Enhanced performance metrics

### [2.0.0] - Planned
- [ ] Machine learning for pattern detection
- [ ] Multi-sport support (basketball, tennis)
- [ ] Odds movement tracking
- [ ] Advanced analytics engine
