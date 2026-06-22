package com.salsaruta.app.print;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CapacitorPrint")
public class PrintPlugin extends Plugin {
    // Keep a class-level reference to prevent immediate Garbage Collection
    private WebView mWebView; 

    @PluginMethod
    public void print(PluginCall call) {
        String content = call.getString("content");

        if (content == null || content.trim().isEmpty()) {
            call.reject("El contenido HTML es requerido");
            return;
        }

        bridge.getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Context context = bridge.getContext();
                    mWebView = new WebView(context);
                    
                    // Force the print job to wait until the HTML completely loads
                    mWebView.setWebViewClient(new WebViewClient() {
                        @Override
                        public void onPageFinished(WebView view, String url) {
                            PrintManager printManager = (PrintManager) context.getSystemService(Context.PRINT_SERVICE);
                            String jobName = "Recibo_SalsaRuta";

                            PrintDocumentAdapter printAdapter = mWebView.createPrintDocumentAdapter(jobName);
                            printManager.print(jobName, printAdapter, new PrintAttributes.Builder().build());
                            
                            JSObject ret = new JSObject();
                            ret.put("success", true);
                            call.resolve(ret);
                        }
                    });

                    mWebView.loadDataWithBaseURL(null, content, "text/HTML", "UTF-8", null);
                    
                } catch (Exception e) {
                    call.reject("Error nativo al intentar imprimir: " + e.getMessage());
                }
            }
        });
    }
}
