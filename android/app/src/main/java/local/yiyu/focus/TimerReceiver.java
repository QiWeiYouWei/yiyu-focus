package local.yiyu.focus;
import android.content.*;
import org.json.*;
public final class TimerReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){try{JSONObject s=StateStore.get(context).load(),a=s==null?null:s.optJSONObject("active");if(a==null||!a.optBoolean("running")||!a.optString("id").equals(intent.getStringExtra("session")))return;long deadline=a.getLong("anchor")+(long)(a.getDouble("duration")*60000-a.getDouble("elapsed"));if(System.currentTimeMillis()+1000<deadline){Reminders.schedule(context,s);return;}Reminders.notify(context,"break".equals(a.optString("kind"))?"休息结束，准备好再开始。":"时间到了。读完这一段、再加 5 分钟，或回来结束。",true);}catch(Exception ignored){}}
}
