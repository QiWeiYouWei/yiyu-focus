package local.yiyu.focus;
import android.app.*;
import android.content.*;
import android.net.Uri;
import org.json.*;
import java.time.*;
import java.util.*;
final class CalendarReminders {
 static final String CHANNEL="calendar-gentle";
 static long time(JSONObject e){try{JSONObject r=e.optJSONObject("reminder");if(r==null||e.optBoolean("done"))return -1;String anchor="deadline".equals(r.optString("anchor"))?e.getString("deadline"):e.getString("date")+"T"+(e.optString("time").isEmpty()?"09:00":e.getString("time"));return LocalDateTime.parse(anchor).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()-r.getLong("minutes")*60000;}catch(Exception ignored){return -1;}}
 static JSONObject event(JSONObject s,String id){JSONArray rows=s==null?null:s.optJSONArray("events");if(rows!=null)for(int i=0;i<rows.length();i++){JSONObject e=rows.optJSONObject(i);if(e!=null&&id.equals(e.optString("id")))return e;}return null;}
 static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("calendar-reminders",0);}
 static JSONObject index(Context c){try{return new JSONObject(prefs(c).getString("index","{}"));}catch(Exception e){return new JSONObject();}}
 static PendingIntent alarm(Context c,String id,String key,String action){return PendingIntent.getBroadcast(c,0,new Intent(c,CalendarReceiver.class).setAction(action).setData(Uri.parse("yiyu://calendar/"+Uri.encode(id)+"/"+action)).putExtra("eventId",id).putExtra("key",key),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 static void set(Context c,String id,JSONObject row)throws Exception{AlarmManager manager=c.getSystemService(AlarmManager.class);PendingIntent pi=alarm(c,id,row.getString("key"),"deliver");long at=row.getLong("at");try{if(Reminders.exact(c))manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pi);else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pi);}catch(SecurityException e){manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pi);}}
 static synchronized void schedule(Context c,JSONObject state,boolean force)throws Exception{
  c.getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(CHANNEL,"日历与截止日期",NotificationManager.IMPORTANCE_DEFAULT));
  JSONObject before=index(c),next=new JSONObject();JSONArray events=state==null?null:state.optJSONArray("events");long now=System.currentTimeMillis();
  if(events!=null)for(int i=0;i<events.length();i++){JSONObject e=events.optJSONObject(i);if(e==null)continue;long trigger=time(e);if(trigger<0)continue;String id=e.getString("id"),key=id+":"+trigger;JSONObject old=before.optJSONObject(id),row=old!=null&&key.equals(old.optString("key"))?new JSONObject(old.toString()):new JSONObject().put("key",key).put("at",trigger).put("done",false);next.put(id,row);if(!row.optBoolean("done")&&(force||old==null||!key.equals(old.optString("key")))){if(row.getLong("at")<now-86400000)row.put("done",true);else set(c,id,row);}}
  Iterator<String> keys=before.keys();while(keys.hasNext()){String id=keys.next();if(!next.has(id)){c.getSystemService(AlarmManager.class).cancel(alarm(c,id,"","deliver"));c.getSystemService(NotificationManager.class).cancel(id,40);}}
  prefs(c).edit().putString("index",next.toString()).commit();
 }
 static synchronized void deliver(Context c,String id,String key)throws Exception{deliver(c,StateStore.get(c),id,key);}
 static synchronized void deliver(Context c,StateStore data,String id,String key)throws Exception{
  JSONObject e=event(data.load(),id),rows=index(c),row=rows.optJSONObject(id);if(e==null||row==null||row.optBoolean("done")||!key.equals(row.optString("key"))||!key.equals(id+":"+time(e)))return;
  if(row.getLong("at")>System.currentTimeMillis()+1000){set(c,id,row);return;}
  row.put("done",true);prefs(c).edit().putString("index",rows.toString()).commit();
  Intent open=new Intent(c,MainActivity.class).setAction("calendar.open").setData(Uri.parse("yiyu://event/"+Uri.encode(id))).putExtra("eventId",id).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
  PendingIntent pending=PendingIntent.getActivity(c,0,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  Notification note=new Notification.Builder(c,CHANNEL).setSmallIcon(R.drawable.ic_leaf).setContentTitle("一隅 · 日历提醒").setContentText(e.optString("title")).setStyle(new Notification.BigTextStyle().bigText(e.optString("title"))).setContentIntent(pending).setAutoCancel(true).addAction(new Notification.Action.Builder(null,"10 分钟后提醒",alarm(c,id,key,"snooze")).build()).build();
  try{c.getSystemService(NotificationManager.class).notify(id,40,note);}catch(SecurityException ignored){}
 }
 static synchronized void snooze(Context c,String id,String key)throws Exception{snooze(c,StateStore.get(c),id,key);}
 static synchronized void snooze(Context c,StateStore data,String id,String key)throws Exception{JSONObject rows=index(c),row=rows.optJSONObject(id),e=event(data.load(),id);if(row==null||e==null||time(e)<0||!row.optString("key").equals(id+":"+time(e))||(key!=null&&!key.equals(row.optString("key"))))throw new java.io.IOException("这项安排已删除或提醒已修改");row.put("done",false).put("at",System.currentTimeMillis()+600000);prefs(c).edit().putString("index",rows.toString()).commit();set(c,id,row);c.getSystemService(NotificationManager.class).cancel(id,40);}
}
