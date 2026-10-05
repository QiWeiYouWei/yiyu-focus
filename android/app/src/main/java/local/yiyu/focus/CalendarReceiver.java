package local.yiyu.focus;
import android.content.*;
public final class CalendarReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context c,Intent intent){PendingResult pending=goAsync();new Thread(()->{try{String id=intent.getStringExtra("eventId"),key=intent.getStringExtra("key");if(id!=null&&key!=null){if("snooze".equals(intent.getAction()))CalendarReminders.snooze(c,id,key);else CalendarReminders.deliver(c,id,key);}}catch(Exception ignored){}finally{pending.finish();}},"calendar-reminder").start();}
}
