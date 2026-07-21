# CoachOS XC — Product Roadmap

## Product standard
CoachOS XC is being built as a production-grade coaching platform, not a demo tracker. The product should feel fast enough for daily practice, trustworthy enough for athlete data, and polished enough for a school, club, or athletic department to pay for.

## Core product promise
**You coach the athletes. CoachOS handles the operational work and turns team data into better decisions.**

## Phase 1 — Professional XC workspace
- Responsive desktop, tablet, and iPhone experience
- Professional dashboard and navigation
- Team profile and season settings
- Athlete roster with boys/girls filters
- Bulk roster paste/import
- Daily attendance
- Practice planning and session history
- Batch timing for 1 Mile, 2 Mile, and 5K
- Automatic PR tracking
- Performance history
- Training groups
- Attendance and data-coverage insights
- Top improvers
- CSV export
- JSON backup/restore
- Offline-friendly PWA shell

## Phase 2 — Athlete intelligence
- Full athlete profile pages
- Athlete notes and status
- Individual performance charts
- PR history and trend lines
- Weekly mileage tracking
- Workout completion history
- Training paces
- Athlete-specific recommendations
- Boys and girls team analysis
- Training-load and consistency flags
- Coach-controlled recommendations with no automatic training changes

## Phase 3 — Practice command center
- One-tap daily practice workflow
- Fast attendance mode
- Stopwatch/batch finish capture
- Split entry
- Multiple timing distances
- Workout templates
- Assign workouts by training group
- Practice completion and notes
- Assistant coach workflow
- Voice-to-log workflow for roster, attendance, times, and notes

## Phase 4 — Cloud product
- Secure authentication
- Cloud database
- Team-based data isolation
- Head coach and assistant coach roles
- Multi-device synchronization
- Account recovery
- Audit-friendly timestamps
- School/team switching
- Reliable backups

## Phase 5 — Meets and season management
- Meet calendar
- Race entries
- Meet results
- Course and distance records
- Season-best tracking
- Team scoring tools
- Championship progression
- Exportable reports
- Printable and shareable athlete progress summaries

## Phase 6 — CoachOS Intelligence
- Team trend analysis
- Individual athlete trend analysis
- Workout-balance analysis
- Identify gaps in aerobic, threshold, speed, and race-specific work from entered training data
- Suggested training-group adjustments
- Season progression summaries
- Race-readiness indicators
- Natural-language coach queries over team data

All recommendations remain decision support. The coach retains final control.

## Phase 7 — Commercial launch
- Subscription billing
- Free trial/founding coach plan
- Coach Pro plan
- Seasonal team plan
- Athletic department plan
- Onboarding flow
- Demo team
- Marketing site
- Support and feedback workflow
- Privacy policy and terms

## Non-negotiable product principles
1. **Practice-speed UX:** common tasks should take seconds, not minutes.
2. **Mobile first:** the iPhone experience must be excellent, not merely functional.
3. **Coach control:** recommendations assist rather than replace coaching judgment.
4. **Data integrity:** no silent overwrites, ambiguous times, or unexplained calculations.
5. **Professional presentation:** consistent typography, spacing, navigation, empty states, and feedback.
6. **Privacy and security:** production athlete data must move from local-only storage to authenticated, access-controlled cloud storage before broad release.
7. **Useful before AI:** the core product must remain valuable even without generated recommendations.

## Immediate build order
1. Athlete profile pages and progress charts
2. Mileage and workout history
3. Faster practice/timing workflow
4. Cloud authentication and database
5. Head coach + assistant coach roles
6. Multi-device sync
7. AI decision-support layer
8. Payments and commercial launch

## Launch target
The initial live beta is the XC module. The architecture should allow CoachOS to expand later into additional sports without turning the XC product into a generic, watered-down team-management app.
