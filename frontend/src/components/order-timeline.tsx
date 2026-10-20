import { View } from 'react-native';
import { timelineSteps, orderTime, type DemoOrder } from '../domain/orders';
import { Card, Text, colors, s } from './ui';
import { Icon } from './icon';

export function OrderTimeline({ order }: { order: DemoOrder }) {
  const steps = timelineSteps(order.method);
  return <Card><Text accessibilityRole="header" style={s.heading}>Order progress</Text><Text style={s.caption}>Updates are simulated using the preview controls below.</Text>
    {steps.map((step, index) => {
      const event = order.events.find(event => event.status === step.status);
      const active = order.status === step.status;
      return <View key={step.status} style={{ flexDirection: 'row', gap: 12, alignItems: 'stretch' }}>
        <View style={{ width: 26, alignItems: 'center' }}><View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: event ? 0 : 1.5, borderColor: colors.line, backgroundColor: event ? colors.teal : colors.white, alignItems: 'center', justifyContent: 'center' }}>{event && <Icon name={active ? 'clock' : 'check'} size={16} color={colors.white} />}</View>{index < steps.length - 1 && <View style={{ flex: 1, minHeight: 18, width: 1, backgroundColor: colors.line, marginTop: 5 }} />}</View>
        <View style={{ flex: 1, gap: 4, paddingBottom: index < steps.length - 1 ? 14 : 0 }}><Text style={{ fontWeight: event ? '600' : '400', color: event ? colors.dark : colors.muted }}>{step.label}</Text><Text style={s.caption}>{event ? orderTime(event.at) : 'Not reached'}</Text></View>
      </View>;
    })}
  </Card>;
}
