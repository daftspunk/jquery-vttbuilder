/*!
 * VTTBuilder - WebVTT builder with jQuery
 *   http://daftspunk.com/
 *
 * Copyright (c) 2012 Sam Georges (http://daftspunk.com)
 * Dual licensed under the MIT (http://www.opensource.org/licenses/mit-license.php)
 * and GPL (http://www.opensource.org/licenses/gpl-license.php) licenses.
 *
 * Built on top of the jQuery library
 *   http://jquery.com
 *
 * Inspired by "HTML5 Video Caption Maker" by Jay Munro, Microsoft Corporation
 *   http://ie.microsoft.com/testdrive/Graphics/CaptionMaker/
 *
 */

/*global window, jQuery */
(function($) {


    var defaults = {
        tracker_size:50
    }, window_loaded = false;

    $(window).bind('load.vttbuilder', function() { window_loaded = true; });

    $.fn.vttbuilder = function(options) {

        var self = this;
        var element = $(this);
        this.options = $.extend(true, defaults, options || {});

        this.list = null;
        this.status = null;
        this.status_start = null;
        this.status_end = null;
        this.control_panel = null;
        this.button_play = null;
        this.button_pause = null;
        this.video = null;
        this.video_obj = null;
        this.video_id = null;
        this.caption = null;
        this.caption_text = null;
        this.caption_save = null;
        this.caption_update = null;
        this.caption_continue = null;
        this.caption_pause = null;
        this.caption_delete = null;
        this.timeline = null;
        this.timeline_list = null;
        this.timeline_tracker = null;
        this.val = null;
        this.val_value = null;

        this.last_headpoint = 0;
        this.current_headpoint = 0;
        this.timeline_offset = 0;
        this.timeline_size = 0;

        this.current_id = 1;
        this.edit_cue = null;
        this.captions = [];
        this.cues = [];
        this.handles = [];

        this.init = function() {

            // List
            self.list = element.find('.vttb_list:first');

            // Status
            self.status = element.find('.vttb_status:first').hide();
            self.status_start = self.status.find('.start:first');
            self.status_end = self.status.find('.end:first');

            // Control panel
            self.control_panel = element.find('.vttb_controls:first');
            self.button_play = self.control_panel.find('.play:first').click(self.button_play_event);
            self.button_pause = self.control_panel.find('.pause:first').click(self.button_pause_event);

            // Video
            self.video = element.find('.vttb_video:first');
            self.video_id = self.video.find('video:first').attr('id');
            self.video_obj = _V_('id_video');

            // Caption
            this.caption = element.find('.vttb_caption:first');
            this.caption_text = this.caption.find('.text:first');
            this.caption_save = this.caption.find('.save:first').click(function() { self.caption_save_event(); }).hide();
            this.caption_update = this.caption.find('.update:first').click(function() { self.caption_update_event(); }).hide();
            this.caption_continue = this.caption.find('.continue:first').click(function() { self.caption_continue_event(); }).hide();
            this.caption_delete = this.caption.find('.delete:first').click(function() { self.caption_delete_event(); }).hide();
            this.caption_pause = this.caption.find('.pause:first');

            // Timeline
            this.timeline = element.find('.vttb_timeline:first');
            this.timeline_list = this.timeline.find('ul:first');
            this.timeline_tracker = this.timeline.find('.tracker');

            // Value
            this.val = element.find('.vttb_val:first');
            this.val_value = this.val.find('.value:first');

            // Video events
            self.video_obj.on("loadedmetadata", function() { self.load_timeline(Math.round(this.duration())); });
            self.video_obj.on("timeupdate", function() {
                var current_time = this.currentTime();
                self.update_timeline(current_time);
                self.update_captions(current_time);
                self.update_status();
            });
            self.video_obj.on("play", function() {
                self.button_play.addClass('active');
                self.button_pause.removeClass('active');
                self.caption_text.attr('disabled', true);
                self.caption_pause.show();
            });
            self.video_obj.on("pause", function() {
                self.button_pause.addClass('active');
                self.button_play.removeClass('active');
                self.caption_text.attr('disabled', false);
                self.caption_pause.hide();
            });

            // List events
            self.list.find('dl').live('click', function() {
                var id = $(this).data('id');
                self.state_edit_caption(id);
            });

            // Load exisiting VTT content
            self.load_vtt();
        };

        // List
        //

        this.rebuild_list = function() {
            self.list.empty();
            $.each(self.captions, function(key,cap){
                self.list.append($('<dl data-id="'+cap.id+'"><dd>'+self.parse_time(cap.start)+'</dd><dd>'+self.parse_time(cap.end)+'</dd><dd>'+cap.caption+'</dd></dl>'));
            });

            // Save VTT
            self.val_value.val(self.save_vtt());
        };

        // Status
        //
        this.update_status = function() {
            self.status.show();
            self.set_status(self.last_headpoint,self.current_headpoint);
        };

        this.set_status = function(start, end) {
            self.status_start.text(self.parse_time(start));
            self.status_end.text(self.parse_time(end));
        };

        // Control panel
        //

        this.button_play_event = function() {
            self.video_obj.play();
        };

        this.button_pause_event = function() {
            self.video_obj.pause();
        };


        // Timeline (seconds)
        //

        this.load_timeline = function(duration) {
            self.timeline_size = duration*self.options.tracker_size;
            self.timeline_list.empty();
            self.timeline_list.width(self.timeline_size);
            for (i = 0; i < duration; i++) {
                self.timeline_list.append($('<li />').addClass(self.get_time_class(i)).html(i+"s"));
            }
            self.timeline.scrollTo({left:0, top:0});
        };

        this.update_timeline = function(current_time) {
            self.current_headpoint = current_time;
            var timeline_width = self.timeline.width();
            var left_offset = (current_time*self.options.tracker_size) - (timeline_width/2);
            var full_offset = self.timeline_size - timeline_width;

            if (left_offset < 0)
                left_offset = 0;
            else if (left_offset > full_offset)
                left_offset = full_offset;

            self.timeline_offset = left_offset;
            self.timeline.scrollTo({left:left_offset, top:0});
            self.timeline_tracker.width(current_time*self.options.tracker_size);

        };

        // Timeline (tags)
        //

        this.create_tag = function(cue) {
            var cue_width = (cue.end - cue.start) * self.options.tracker_size;
            var cue_left = cue.start * self.options.tracker_size;
            var cue_right = cue.end * self.options.tracker_size;
            var cue_el = $('<div />')
                .attr('data-id', cue.id)
                .addClass('cue')
                .addClass('cue-'+cue.id)
                .css('left',cue_left)
                .width(cue_width)
                .text(cue.caption);

            var handle_el = $('<div />').addClass('handle').css('left', cue_right);
            self.timeline.append(cue_el).append(handle_el);

            self.cues[cue.id] = cue_el;
            self.handles[cue.id] = handle_el;

            handle_el.drag(function(ev, dd){
                self.move_tag($(this), dd.offsetX);
            }, {relative:true});
        };


        this.move_tag = function(handle, offset_left) {

            var drag_left = self.timeline_offset+offset_left;

            if (drag_left > self.timeline_list.width() || drag_left < 0)
                return;

            // Handle previous / left
            var previous = handle.prev();
            var cue_left = self.find_caption_by_id(previous.data('id'));

            if (drag_left <= (cue_left.start * self.options.tracker_size))
                return;

            // Handle next / right
            var next = handle.next();
            if (next.length > 0) {
                var cue_right = self.find_caption_by_id(next.data('id'));

                if (drag_left >= (cue_right.end * self.options.tracker_size))
                    return;
            }

            // Good to go...
            self.reset_tag_left(previous, cue_left, drag_left);
            if (next.length > 0) {
                self.reset_tag_right(next, cue_right, drag_left);
            }
            else if (drag_left > self.current_headpoint) {
                self.last_headpoint = drag_left / self.options.tracker_size;
                self.update_status();
            }

            handle.css({ left:drag_left });

            // Rebuild the list
            self.rebuild_list();
        };

        this.reset_tag_left = function(el, cue, drag_left) {
            cue.end = drag_left / self.options.tracker_size;
            var cue_width = (cue.end - cue.start) * self.options.tracker_size;
            el.width(cue_width);
        };

        this.reset_tag_right = function(el, cue, drag_left) {
            cue.start = drag_left / self.options.tracker_size;
            var cue_width = (cue.end - cue.start) * self.options.tracker_size;
            el.css('left', drag_left);
            el.width(cue_width);
        }


        // Create caption
        //

        this.caption_continue_event = function() {
            self.caption_save_event(true);
        };

        this.caption_save_event = function(is_continue) {

            var cue = {
                id: self.current_id,
                start: self.last_headpoint,
                end: self.current_headpoint,
                caption: self.caption_text.val()
            };

            if (cue.start >= cue.end)
                return;

            self.captions.push(cue);
            self.create_tag(cue);
            self.last_headpoint = self.current_headpoint;
            self.current_id++;
            self.caption_text.val('');

            if (is_continue)
                self.button_play_event();

            self.rebuild_list();
        };

        this.state_create_caption = function() {
            self.caption_text.val('');

            self.caption_save.show();
            self.caption_continue.show();
            self.caption_update.hide();
            self.caption_delete.hide();
        };


        // Update caption
        //

        this.caption_update_event = function() {
            self.edit_cue.caption = self.caption_text.val();
            self.timeline.find('.cue-'+self.edit_cue.id).text(self.edit_cue.caption);
            self.rebuild_list();
        };

        this.state_edit_caption = function(id) {
            var cue = self.find_caption_by_id(id);
            self.caption_text.val(cue.caption);
            self.edit_cue = cue;
            self.set_status(cue.start, cue.end);

            self.caption_save.hide();
            self.caption_continue.hide();
            self.caption_update.show();
            self.caption_delete.show();

        };

        // Delete caption
        //

        this.caption_delete_event = function() {

            var index = self.captions.indexOf(self.edit_cue);
            var drag_left = self.edit_cue.start * self.options.tracker_size;
            if(index != -1)
                self.captions.splice(index, 1)

            var cue = self.timeline.find('.cue-'+self.edit_cue.id);
            var handle = cue.next();
            var prev_handle = cue.prev();
            handle.remove();
            cue.remove();

            var previous = prev_handle.prev();
            var next = prev_handle.next();

            if (previous.length > 0 && previous.data('id')) {
                var cue_left = self.find_caption_by_id(previous.data('id'));
                self.reset_tag_left(previous, cue_left, drag_left);
                self.edit_cue = cue_left;
            }
            if (next.length > 0 && next.data('id')) {
                var cue_right = self.find_caption_by_id(next.data('id'));
                self.reset_tag_right(next, cue_right, drag_left);
                self.edit_cue = cue_right;
            }

            if (self.captions.length == 0)
                self.last_headpoint = 0;
            else {
                var last_cue = self.captions[self.captions.length-1];
                self.last_headpoint = last_cue.end;
            }

            self.update_status();
            self.rebuild_list();
        };


        // Captions
        //

        this.update_captions = function(current_time) {
            var exisiting_cue = self.find_caption_by_time(current_time);

            if (exisiting_cue)
                self.state_edit_caption(exisiting_cue.id);
            else
                self.state_create_caption();
        };

        // VTT specific
        //

        this.load_vtt = function() {
            var content = self.val_value.val();
            self.parse_cues(content);
            $.each(self.captions, function(key, cue){
                self.current_headpoint = cue.end;
                self.last_headpoint = cue.end;
                self.current_id = cue.id;
                self.create_tag(cue);
            });
            self.current_id++;
            self.rebuild_list();
        };


        this.save_vtt = function() {
            var str = "";
            str += "WEBVTT\r\n\r\n";
            $.each(self.captions, function(key,cap){
                str += self.parse_time(cap.start);
                str += " --> ";
                str += self.parse_time(cap.end);
                str += "\r\n";
                str += cap.caption;
                str += "\r\n\r\n";
            });
            return str;
        };

        // VTT Helpers
        //

        this.parse_cues = function(content) {
            var cue, time, text,
            lines = content.split("\n"),
            line = "", id;

            for (var i=1, j=lines.length; i<j; i++) {
                line = self.trim(lines[i]);
                if (line) {
                    if (line.indexOf("-->") == -1) {
                        id = line;
                        line = self.trim(lines[++i]);
                    } else {
                        id = self.captions.length;
                    }
                    cue = {
                        id: id + 1,
                        index: self.captions.length
                    };

                    // Timing line
                    time = line.split(" --> ");
                    cue.start = this.parse_cue_time(time[0]);
                    cue.end = this.parse_cue_time(time[1]);
                    text = [];

                    while (lines[++i] && (line = self.trim(lines[i]))) {
                        text.push(line);
                    }

                    cue.caption = text.join('<br/>');
                    self.captions.push(cue);
                }
            }
        };

        this.parse_cue_time = function(time_text) {
            var parts = time_text.split(':'),
                time = 0,
                hours, minutes, other, seconds, ms, flags;

            if (parts.length == 3) {
                hours = parts[0];
                minutes = parts[1];
                other = parts[2];
            } else {
                hours = 0;
                minutes = parts[0];
                other = parts[1];
            }

            other = other.split(/\s+/)
            seconds = other.splice(0,1)[0];
            seconds = seconds.split(/\.|,/);
            ms = parseFloat(seconds[1]);
            seconds = seconds[0];

            time += parseFloat(hours) * 3600;
            time += parseFloat(minutes) * 60;
            time += parseFloat(seconds);
            if (ms) { time += ms/1000; }

            return time;
        };

        // Helpers
        //

        this.trim = function(string) {
            return string.toString().replace(/^\s+/, "").replace(/\s+$/, "");
        };

        this.get_time_class = function(time) {
            time = Math.round(time*10)/10;
            return "time"+time.toString().replace('.', '-');
        };

        this.find_caption_by_id = function(id) {
            var result = null;
            $.each(self.captions, function(key,cue) {
                if (cue.id == id)
                    result = cue;
            });
            return result;
        };

        this.find_caption_by_time = function(time) {
            var result = null;
            $.each(self.captions, function(key,cue) {
                if (cue.start <= time && cue.end > time)
                    result = cue;
            });
            return result;
        };

        this.parse_time = function(time) {
            if (!time)
                time = 0;

            var str = "";

            // Hours
            var hrs = Math.floor(time/(60*60));
            if (hrs < 10) str += "0";
            str += hrs.toString() + ":";

            // Minutes
            var min = Math.floor(time/60) % 60;
            if (min < 10) str += "0";
            str += min.toString() + ":";

            // Seconds
            var sec = time % 60;
            if (sec < 10) str += "0";
            str += sec.toFixed(3);

            return str;
        }


        // Bootstrapper
        //
        this.init();

    };



})(jQuery);