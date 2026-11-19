import { ScrollView, View } from 'react-native';
import { timelineSteps, orderTime, type Order } from '../domain/orders';
import { Card, Text, colors, s } from './ui';
import { Icon } from './icon';

export function OrderTimeline({ order, embedded = false, orientation = 'vertical' }: { order: Order; embedded?: boolean; orientation?: 'vertical' | 'horizontal' }) {
  const steps = timelineSteps(order.method, !!order.managed);
  const eventFor = (status: typeof steps[number]['status']) => order.events.find(event => event.status === status);
  const content = <><Text accessibilityRole="header" style={s.heading}>Order progress</Text>{orientation === 'horizontal' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 2, minWidth: '100%', justifyContent: 'center' }}>
    <View style={{ flexDirection: 'row', minWidth: '100%', justifyContent: 'center' }}>{steps.map((step, index) => {
      const event = eventFor(step.status);
      const active = order.status === step.status;
      return <View key={step.status} style={{ width: 148, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: event ? 0 : 1.5, borderColor: colors.line, backgroundColor: event ? colors.teal : colors.white, alignItems: 'center', justifyContent: 'center' }}>{event && <Icon name={active ? 'clock' : 'check'} size={16} color={colors.white} />}</View>{index < steps.length - 1 && <View style={{ flex: 1, height: 1, backgroundColor: event ? colors.teal : colors.line }} />}</View>
        <View style={{ gap: 4, paddingRight: 8 }}><Text style={{ fontWeight: event ? '600' : '400', color: event ? colors.dark : colors.muted }}>{step.label}</Text><Text style={s.caption}>{event ? orderTime(event.at) : 'Not reached'}</Text></View>
      </View>;
    })}</View>
  </ScrollView> : steps.map((step, index) => {
      const event = eventFor(step.status);
      const active = order.status === step.status;
      return <View key={step.status} style={{ flexDirection: 'row', gap: 12, alignItems: 'stretch' }}>
        <View style={{ width: 26, alignItems: 'center' }}><View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: event ? 0 : 1.5, borderColor: colors.line, backgroundColor: event ? colors.teal : colors.white, alignItems: 'center', justifyContent: 'center' }}>{event && <Icon name={active ? 'clock' : 'check'} size={16} color={colors.white} />}</View>{index < steps.length - 1 && <View style={{ flex: 1, minHeight: 18, width: 1, backgroundColor: colors.line, marginTop: 5 }} />}</View>
        <View style={{ flex: 1, gap: 4, paddingBottom: index < steps.length - 1 ? 14 : 0 }}><Text style={{ fontWeight: event ? '600' : '400', color: event ? colors.dark : colors.muted }}>{step.label}</Text><Text style={s.caption}>{event ? orderTime(event.at) : 'Not reached'}</Text></View>
      </View>;
    })}</>;
  return embedded ? <View style={{ gap: 12 }}>{content}</View> : <Card>{content}</Card>;
}
