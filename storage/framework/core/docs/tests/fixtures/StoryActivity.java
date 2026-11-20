package dev.stacks.storyfixture;
import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.TextView;

public final class StoryActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout layout = new FrameLayout(this);
        layout.setBackgroundColor(0xfffafafa);
        TextView title = new TextView(this);
        title.setText("Review cart");
        title.setTextSize(28);
        title.setTextColor(0xff111111);
        title.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams top = new FrameLayout.LayoutParams(-1, 160, Gravity.TOP);
        top.topMargin = 200;
        layout.addView(title, top);
        Button buy = new Button(this);
        buy.setAllCaps(false);
        buy.setText("Buy");
        buy.setOnClickListener(view -> { title.setText("Order confirmed"); buy.setText("Purchased"); });
        layout.addView(buy, new FrameLayout.LayoutParams(420, 180, Gravity.CENTER));
        setContentView(layout);
    }
}
