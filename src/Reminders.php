<?php

namespace Convoro\Ext\Calendar;

use App\Models\User;
use App\Support\Notifier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Sends reminders to event attendees. Run on a schedule (registered from the
 * extension's provider). Two windows — ~a day before and ~an hour before — each
 * fire once per event, tracked by the reminded_day / reminded_hour flags.
 */
class Reminders
{
    public static function run(): void
    {
        if (! Schema::hasTable('events') || ! Schema::hasColumn('events', 'reminded_day')) {
            return;
        }

        // Event times are stored in UTC; compare against UTC now.
        $now = now()->utc();

        // Day-before window: event starts within the next 24h.
        self::fire(
            DB::table('events')
                ->where('reminded_day', false)
                ->whereBetween('starts_at', [$now->toDateTimeString(), $now->copy()->addDay()->toDateTimeString()])
                ->get(['id', 'title', 'starts_at']),
            'reminded_day',
        );

        // Final reminder: event starts within the next hour.
        self::fire(
            DB::table('events')
                ->where('reminded_hour', false)
                ->whereBetween('starts_at', [$now->toDateTimeString(), $now->copy()->addHour()->toDateTimeString()])
                ->get(['id', 'title', 'starts_at']),
            'reminded_hour',
        );
    }

    /** @param \Illuminate\Support\Collection<int,object> $events */
    private static function fire($events, string $flag): void
    {
        foreach ($events as $ev) {
            // Notify everyone going or maybe, plus the organizer.
            $userIds = DB::table('event_rsvps')
                ->where('event_id', $ev->id)
                ->whereIn('status', ['going', 'maybe'])
                ->pluck('user_id')
                ->all();
            $organizer = DB::table('events')->where('id', $ev->id)->value('user_id');
            if ($organizer) {
                $userIds[] = (int) $organizer;
            }
            $userIds = array_values(array_unique(array_map('intval', $userIds)));

            $when = Carbon::parse($ev->starts_at, 'UTC')->diffForHumans(['parts' => 1]);
            $text = '📅 “'.trim((string) $ev->title).'” starts '.$when;

            foreach (User::whereIn('id', $userIds)->get() as $user) {
                try {
                    Notifier::send($user, new EventReminderNotification((int) $ev->id, $text));
                } catch (\Throwable $e) {
                    // One bad recipient must never stall the whole pass.
                }
            }

            DB::table('events')->where('id', $ev->id)->update([$flag => true]);
        }
    }
}
