package local.yiyu.focus;
import android.Manifest;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.webkit.*;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

public final class MainActivity extends ComponentActivity {
 private WebView web;private final ExecutorService storage=Executors.newSingleThreadExecutor(),network=Executors.newSingleThreadExecutor();private StateStore store;private Credentials credentials;private Nutstore client;private String device,startupError="";private ValueCallback<Uri[]> fileCallback;private JSONObject pendingExport;private String pendingChoose,pendingExportId;private boolean loaded,initialResume=true;
 static final String HOME="https://appassets.androidplatform.net/web/index.html";
 @Override public void onCreate(Bundle saved){super.onCreate(saved);store=StateStore.get(this);credentials=new Credentials(this);device=getSharedPreferences("native",0).getString("device","");if(!device.matches("[a-f0-9-]{36}")){device=UUID.randomUUID().toString();getSharedPreferences("native",0).edit().putString("device",device).apply();}try{JSONObject savedAuth=credentials.load();if(savedAuth!=null)client=new Nutstore(savedAuth);}catch(Exception e){startupError="保存的账号授权无法读取，请重新填写应用密码。本机记录未受影响。";}Reminders.channels(this);try{Reminders.reschedule(this,Reminders.checkBoot(this,store));}catch(Exception ignored){}getWindow().setStatusBarColor(Color.rgb(245,245,247));getWindow().setNavigationBarColor(Color.rgb(245,245,247));getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
  FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.rgb(245,245,247));web=new WebView(this);root.addView(web,new FrameLayout.LayoutParams(-1,-1));setContentView(root);
  root.setOnApplyWindowInsetsListener((view,insets)->{int bottom=insets.getSystemWindowInsetBottom();view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),bottom);return insets.consumeSystemWindowInsets();});root.requestApplyInsets();
  WebSettings config=web.getSettings();config.setJavaScriptEnabled(true);config.setDomStorageEnabled(true);config.setAllowFileAccess(false);config.setAllowContentAccess(false);config.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);config.setSupportMultipleWindows(false);config.setMediaPlaybackRequiresUserGesture(true);config.setSafeBrowsingEnabled(true);config.setTextZoom(100);web.setBackgroundColor(Color.rgb(245,245,247));WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);web.addJavascriptInterface(new Bridge(),"YiyuAndroid");
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){Uri u=req.getUrl();return !isHome(u);}
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest req){Uri u=req.getUrl();if(!"https".equals(u.getScheme())||!"appassets.androidplatform.net".equals(u.getHost())||u.getPort()!=-1)return denied();String p=u.getPath();if(p==null||!p.matches("/web/[A-Za-z0-9._-]+"))return denied();try{String type=p.endsWith(".html")?"text/html":p.endsWith(".mjs")?"text/javascript":p.endsWith(".css")?"text/css":p.endsWith(".svg")?"image/svg+xml":"image/png";return new WebResourceResponse(type,"UTF-8",200,"OK",Map.of("Cache-Control","no-store","Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'"),getAssets().open(p.substring(1)));}catch(IOException e){return denied();}}
   @Override public void onPageFinished(WebView view,String url){loaded=isHome(Uri.parse(url));}
   @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){view.destroy();new AlertDialog.Builder(MainActivity.this).setTitle("专注窗口需要重新打开").setMessage("最近的本机记录已保留，请重新打开一隅。").setPositiveButton("关闭",(d,w)->finish()).show();return true;}
  });
  web.setWebChromeClient(new WebChromeClient(){@Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE);try{startActivityForResult(i,31);}catch(Exception e){fileCallback.onReceiveValue(null);fileCallback=null;}return true;}});
  getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){@Override public void handleOnBackPressed(){handleBack();}});
  web.loadUrl(HOME);
 }
 private static boolean isHome(Uri u){return "https".equals(u.getScheme())&&"appassets.androidplatform.net".equals(u.getHost())&&u.getPort()==-1&&"/web/index.html".equals(u.getPath());}
 private static WebResourceResponse denied(){return new WebResourceResponse("text/plain","UTF-8",403,"Forbidden",Map.of(),new ByteArrayInputStream(new byte[0]));}
 private JSONObject status()throws Exception{return new JSONObject().put("device",device).put("connected",client!=null).put("username",client==null?"":client.username).put("owner",client==null?JSONObject.NULL:client.owner).put("error",startupError);}
 private void reply(String id,Object value,String error){runOnUiThread(()->{if(web==null||!isHome(Uri.parse(web.getUrl())))return;try{JSONObject r=new JSONObject().put("id",id).put("ok",error==null);if(error==null)r.put("value",value==null?JSONObject.NULL:value);else r.put("error",error);web.evaluateJavascript("window.__yiyuReply&&window.__yiyuReply("+r+")",null);}catch(JSONException ignored){}});}
 public final class Bridge {
  @JavascriptInterface public void post(String json){if(json==null||json.length()>22*1024*1024)return;try{JSONObject call=new JSONObject(json);String action=call.getString("action"),id=call.getString("id");if(id.length()>100)return;Object args=call.opt("args");(action.startsWith("sync:")?network:storage).execute(()->{try{Object result=dispatch(id,action,args);if(result!=Pending.INSTANCE)reply(id,result,null);}catch(Exception e){reply(id,null,e.getMessage()==null?"操作失败，请重试":e.getMessage());}});}catch(JSONException ignored){}}
 }
 enum Pending { INSTANCE }
 private Object dispatch(String id,String action,Object args)throws Exception {
  switch(action){
   case "data:load":return store.load();
   case "data:save":store.save((JSONObject)args);Reminders.schedule(this,(JSONObject)args);return true;
   case "data:restore":store.restore((JSONObject)args);Reminders.schedule(this,(JSONObject)args);return true;
   case "backup:list":return store.list();
   case "backup:read":return store.backup((String)args);
   case "backup:now":return store.snapshot((JSONObject)args,"手动备份");
   case "backup:export":StateStore.validate((JSONObject)args);runOnUiThread(()->{if(pendingExport!=null){reply(id,null,"还有一个导出正在进行");return;}pendingExport=(JSONObject)args;pendingExportId=id;startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,"一隅备份-"+System.currentTimeMillis()+".json"),32);});return Pending.INSTANCE;
   case "material:choose":runOnUiThread(()->{if(pendingChoose!=null){reply(id,null,"已有选择窗口，请先完成");return;}pendingChoose=id;startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/pdf","text/plain","video/*","image/*","application/vnd.openxmlformats-officedocument.wordprocessingml.document"}),33);});return Pending.INSTANCE;
   case "material:open":String location=(String)args;if(location.length()>2000)throw new IOException("资料位置无效");Uri u=Uri.parse(location);if(!Set.of("https","http","content").contains(u.getScheme()))throw new IOException("请在手机重新选择资料，或填写网页地址");if("content".equals(u.getScheme())){boolean granted=false;for(UriPermission p:getContentResolver().getPersistedUriPermissions())if(p.isReadPermission()&&p.getUri().equals(u))granted=true;if(!granted)throw new IOException("资料授权已失效，请重新选择文件");}runOnUiThread(()->{try{Intent i=new Intent(Intent.ACTION_VIEW,u).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);if("content".equals(u.getScheme()))i.setDataAndType(u,getContentResolver().getType(u));startActivity(i);}catch(Exception e){new AlertDialog.Builder(this).setMessage("手机没有能打开这份资料的应用，请选择其他资料。").setPositiveButton("知道了",null).show();}});return true;
   case "notify":Reminders.notify(this,String.valueOf(args),false);return true;
   case "mobile:status":return new JSONObject().put("notifications",getSystemService(NotificationManager.class).areNotificationsEnabled()).put("exact",Reminders.exact(this));
   case "mobile:notifications":runOnUiThread(()->{if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},34);else startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()));});return true;
   case "mobile:exact":runOnUiThread(()->{if(Build.VERSION.SDK_INT>=31&&!Reminders.exact(this))startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getPackageName())));});return true;
   case "sync:status":return status();
   case "sync:connect":JSONObject value=(JSONObject)args;Nutstore next=new Nutstore(value);next.connect();credentials.save(new JSONObject().put("username",next.username).put("password",value.getString("password")));client=next;startupError="";return status();
   case "sync:disconnect":credentials.clear();client=null;startupError="";return status();
   case "sync:read":if(client==null)throw new IOException("请先连接坚果云");return new JSONObject().put("owner",client.owner).put("packets",client.read());
   case "sync:write":if(client==null||!client.owner.equals(((JSONObject)args).optString("owner")))throw new IOException("同步账号发生变化，已停止上传");return client.write(device,((JSONObject)args).getJSONObject("packet"));
   default:throw new IOException("此操作在手机端不可用");
  }
 }
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);Uri uri=data==null?null:data.getData();if(request==31){if(fileCallback!=null)fileCallback.onReceiveValue(result==RESULT_OK&&uri!=null?new Uri[]{uri}:null);fileCallback=null;}else if(request==33){String id=pendingChoose;pendingChoose=null;if(id==null)return;if(result!=RESULT_OK||uri==null){reply(id,"",null);return;}try{getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION);reply(id,uri.toString(),null);}catch(Exception e){reply(id,null,"文件读取授权失败，请重新选择");}}else if(request==32){JSONObject exported=pendingExport;String id=pendingExportId;pendingExport=null;pendingExportId=null;if(id==null)return;if(result!=RESULT_OK||uri==null){reply(id,false,null);return;}storage.execute(()->{try(OutputStream out=getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new IOException("导出位置无法写入");out.write(exported.toString(2).getBytes(StandardCharsets.UTF_8));reply(id,true,null);}catch(Exception e){reply(id,null,"备份导出失败，请重试");}});}}
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(web!=null&&loaded)web.evaluateJavascript("window.mobileRefresh&&window.mobileRefresh()",null);}
 @Override protected void onPause(){if(loaded&&web!=null)web.evaluateJavascript("window.prepareForBackground&&window.prepareForBackground()",null);super.onPause();}
 @Override protected void onResume(){super.onResume();if(initialResume){initialResume=false;return;}if(web!=null&&loaded)web.evaluateJavascript("window.resumeFromMobile&&window.resumeFromMobile()",null);try{JSONObject s=store.load();if(s!=null)Reminders.schedule(this,s);}catch(Exception ignored){}}
 private void handleBack(){if(web==null||!loaded){moveTaskToBack(true);return;}web.evaluateJavascript("window.mobileBack?window.mobileBack():false",value->{if(!"true".equals(value)){web.evaluateJavascript("window.prepareForBackground&&window.prepareForBackground()",null);moveTaskToBack(true);}});}
 @Override protected void onDestroy(){if(fileCallback!=null)fileCallback.onReceiveValue(null);storage.shutdown();network.shutdown();if(web!=null){web.removeJavascriptInterface("YiyuAndroid");web.destroy();web=null;}super.onDestroy();}
}
