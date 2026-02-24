import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimeOrders(callback: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          callback();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callback]);
}

export function useRealtimeAssignments(callback: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('assignments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assignments',
        },
        () => {
          callback();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callback]);
}

export function useRealtimeDrivers(callback: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('drivers-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drivers',
        },
        () => {
          callback();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callback]);
}

export function useRealtimeTransactions(callback: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
        },
        () => {
          callback();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callback]);
}

export function useRealtimeChat(conversationId: string, callback: () => void) {
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          callback();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, callback]);
}

export function useRealtimeDriverRoutes(callback: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('driver-routes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_routes' },
        () => { callback(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [callback]);
}

export function useRealtimeRouteStops(callback: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('route-stops-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'route_stops' },
        () => { callback(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [callback]);
}
