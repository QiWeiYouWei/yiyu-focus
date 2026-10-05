package local.yiyu.focus;
import android.content.*;
public final class BootReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){if(!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())&&!Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())&&!Intent.ACTION_TIME_CHANGED.equals(intent.getAction())&&!Intent.ACTION_TIMEZONE_CHANGED.equals(intent.getAction()))return;try{Reminders.reschedule(context,Reminders.checkBoot(context,StateStore.get(context)));}catch(Exception ignored){}}
}
