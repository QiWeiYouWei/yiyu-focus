package local.yiyu.focus;
import android.content.*;
import android.content.pm.*;
import android.graphics.drawable.Icon;
import android.net.Uri;
import org.json.*;
import java.util.*;
final class FocusShortcuts {
 static JSONObject find(JSONObject s,String id){JSONArray rows=s==null?null:s.optJSONArray("focusPresets");if(rows!=null)for(int i=0;i<rows.length();i++){JSONObject p=rows.optJSONObject(i);if(p!=null&&id.equals(p.optString("id")))return p;}return null;}
 static ShortcutInfo build(Context c,JSONObject p)throws Exception{String id=p.getString("id"),title=p.getString("title");if(id.isEmpty()||id.length()>100||title.trim().isEmpty()||title.length()>200)throw new java.io.IOException("快捷入口格式无效");Intent intent=new Intent(c,MainActivity.class).setAction("focus.preset").setData(Uri.parse("yiyu://preset/"+Uri.encode(id))).putExtra("presetId",id);return new ShortcutInfo.Builder(c,id).setShortLabel(title.substring(0,title.offsetByCodePoints(0,Math.min(title.codePointCount(0,title.length()),24)))).setLongLabel(title).setIcon(Icon.createWithResource(c,R.mipmap.ic_launcher)).setIntent(intent).build();}
 static void update(Context c,JSONObject state,JSONArray ordered)throws Exception{ShortcutManager manager=c.getSystemService(ShortcutManager.class);List<ShortcutInfo> next=new ArrayList<>();for(int i=0;i<Math.min(4,Math.min(ordered.length(),manager.getMaxShortcutCountPerActivity()));i++){JSONObject item=ordered.getJSONObject(i),p=find(state,item.getString("id"));if(p!=null)next.add(build(c,p));}if(!manager.isRateLimitingActive())manager.setDynamicShortcuts(next);List<String> disabled=new ArrayList<>(),enabled=new ArrayList<>();List<ShortcutInfo> changed=new ArrayList<>();for(ShortcutInfo pinned:manager.getPinnedShortcuts()){JSONObject p=find(state,pinned.getId());if(p==null)disabled.add(pinned.getId());else {enabled.add(pinned.getId());changed.add(build(c,p));}}if(!disabled.isEmpty())manager.disableShortcuts(disabled,"常用事件已删除");if(!enabled.isEmpty())manager.enableShortcuts(enabled);if(!changed.isEmpty()&&!manager.isRateLimitingActive())manager.updateShortcuts(changed);}
 static boolean pin(Context c,JSONObject state,String id)throws Exception{JSONObject p=find(state,id);if(p==null)throw new java.io.IOException("这项常用事件已删除");ShortcutManager manager=c.getSystemService(ShortcutManager.class);return manager.isRequestPinShortcutSupported()&&manager.requestPinShortcut(build(c,p),null);}
}
