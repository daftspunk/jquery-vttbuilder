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
        //this.button_create = null;
        this.video = null;
        this.video_obj = null;
        this.video_id = null;
        this.caption = null;
        this.caption_text = null;
        this.caption_save = null;
        //this.caption_cancel = null;
        this.timeline = null;
        this.timeline_list = null;
        this.timeline_tracker = null;
        this.val = null;
        this.val_value = null;

        this.last_headpoint = 0;
        this.current_headpoint = 0;
        this.timeline_offset = 0;

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
            //self.button_create = self.control_panel.find('.create:first').click(self.button_create_event).hide();

            // Video
            self.video = element.find('.vttb_video:first');
            self.video_id = self.video.find('video:first').attr('id');
            self.video_obj = _V_(self.video_id);

            // Caption
            this.caption = element.find('.vttb_caption:first');
            this.caption_text = this.caption.find('.text:first');
            this.caption_save = this.caption.find('.save:first').click(function() { self.caption_save_event(); });
            this.caption_continue = this.caption.find('.continue:first').click(function() { self.caption_continue_event(); });
            //this.caption_cancel = this.caption.find('.cancel:first').click(function() { self.caption_cancel_event(); });

            // Timeline
            this.timeline = element.find('.vttb_timeline:first');
            this.timeline_list = this.timeline.find('ul:first');
            this.timeline_tracker = this.timeline.find('.tracker');

            // Value
            this.val = element.find('.vttb_val:first');
            this.val_value = this.val.find('.value:first');

            // Events
            self.video_obj.addEvent("timeupdate", function() { self.video_time_update(this.currentTime()); })
            self.video_obj.addEvent("loadedmetadata", function() {
                var duration = Math.round(self.video_obj.duration());
                self.timeline_list.css('width', (duration*self.options.tracker_size)+'px')
                for (i = 0; i < duration; i++) {
                    self.timeline_list.append($('<li />').addClass(self.get_time_class(i)).addClass('second').html(i+"m"));
                }
                self.timeline.scrollTo({left:0, top:0});
            });
            self.video_obj.addEvent("play", function() {
                self.button_play.addClass('active');
                self.button_pause.removeClass('active');
            });
            self.video_obj.addEvent("pause", function() {
                self.button_pause.addClass('active');
                self.button_play.removeClass('active');
            });

            self.video_obj.ready(function(){
                //self.video_obj.play();
            });

            self.list.find('dl').live('click', function() {
                self.edit_caption($(this).data('id'));
            });

            // Autoload
            self.load_vtt();
        };

        this.edit_caption = function(id, no_time_shift) {
            var cue = self.find_caption_by_id(id);
            //self.caption.show();
            self.caption_text.val(cue.caption);
            self.edit_cue = cue;
            self.set_status(cue.start, cue.end);
            if (!no_time_shift) {
                self.button_pause_event();
                self.video_obj.currentTime(cue.start);
            }
        };

        this.get_time_class = function(time) {
            time = Math.round(time*10)/10;
            return "time"+time.toString().replace('.', '-');
        };

        this.button_play_event = function() {
            self.video_obj.play();
        };

        this.button_pause_event = function() {
            self.video_obj.pause();
        };

        this.button_create_event = function(ignore_replay) {
            // if (!self.caption.is(':visible'))
            //     self.button_pause_event();
            // else if (!ignore_replay)
            //     self.button_play_event();

            //self.caption.toggle();
            //self.edit_cue = false;
        };

        this.caption_continue_event = function() {
            self.caption_save_event(true);
        };

        this.caption_save_event = function(is_continue) {
            if (self.edit_cue) {
                self.edit_cue.caption = self.caption_text.val();
                self.edit_cue = null;
                // self.button_create_event(!is_continue);
            } else {
                var cue = {
                    id: self.current_id,
                    start: self.last_headpoint,
                    end: self.current_headpoint,
                    caption: self.caption_text.val()
                };

                if (cue.start >= cue.end)
                    return;

                self.captions.push(cue);
                self.create_cue(cue);
                self.last_headpoint = self.current_headpoint;
                self.current_id++;
                // self.button_create_event();
                self.caption_text.val('');
            }

            if (is_continue)
                self.button_play_event();

            self.rebuild_list();
        };

        // this.caption_cancel_event = function(no_hide_form) {
        //     self.caption_text.val('');
        //     if (!no_hide_form)
        //         self.caption.hide();
        //     self.edit_cue = false;
        // };

        this.jump_to_last_cue = function() {
            if (self.captions.length > 0) {
                cue = self.captions[self.captions.length-1];
                self.video_obj.currentTime(cue.end);
            }
        };

        this.create_cue = function(cue) {
            var cue_width = (cue.end - cue.start) * self.options.tracker_size;
            var cue_left = cue.start * self.options.tracker_size;
            var cue_right = cue.end * self.options.tracker_size;
            var cue_el = $('<div />').addClass('cue').addClass('cue-'+cue.id).width(cue_width).css('left',cue_left).attr('data-id', cue.id).text(cue.caption);
            var handle_el = $('<div />').addClass('handle').css('left', cue_right);
            self.timeline.append(cue_el).append(handle_el);

            self.cues[cue.id] = cue_el;
            self.handles[cue.id] = handle_el;

            handle_el.drag(function(ev, dd){
                self.resize_cue($(this), dd.offsetX);
            }, {relative:true});
        };

        this.resize_cue = function(handle, offset_left) {

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
            self.reset_cue_left(previous, cue_left, drag_left);
            if (next.length > 0) {
                self.reset_cue_right(next, cue_right, drag_left);
            }
            else if (drag_left > self.current_headpoint) {
                self.last_headpoint = drag_left / self.options.tracker_size;
                self.status_event();
            }

            handle.css({ left:drag_left });
            //self.video_obj.currentTime(drag_left / self.options.tracker_size);

            // Rebuild the list
            self.rebuild_list();
        };

        this.reset_cue_left = function(el, cue, drag_left) {
            cue.end = drag_left / self.options.tracker_size;
            var cue_width = (cue.end - cue.start) * self.options.tracker_size;
            el.width(cue_width);
        };

        this.reset_cue_right = function(el, cue, drag_left) {
            cue.start = drag_left / self.options.tracker_size;
            var cue_width = (cue.end - cue.start) * self.options.tracker_size;
            el.css('left', drag_left);
            el.width(cue_width);
        }

        this.rebuild_list = function() {
            self.list.empty();
            $.each(self.captions, function(key,cap){
                self.list.append($('<dl data-id="'+cap.id+'"><dd>'+self.parse_time(cap.start)+'</dd><dd>'+self.parse_time(cap.end)+'</dd><dd>'+cap.caption+'</dd></dl>'));
            });

            // Set value
            self.val_value.val(self.save_vtt());
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

        this.status_event = function() {
            self.status.show();
            //self.button_create.show();
            self.set_status(self.last_headpoint,self.current_headpoint);
        };

        this.set_status = function(start, end) {
            self.status.show();
            self.status_start.text(self.parse_time(start));
            self.status_end.text(self.parse_time(end));
        };

        this.video_time_update = function(current_time) {
            self.current_headpoint = current_time;
            var timeline_width = self.timeline.width();
            var left_offset = (current_time*self.options.tracker_size) - (timeline_width/2);

            if (left_offset < 0)
                left_offset = 0;

            self.timeline_offset = left_offset;
            self.timeline.scrollTo({left:left_offset, top:0});
            self.timeline_tracker.width(current_time*self.options.tracker_size);

            var exisiting_cue = self.find_caption_by_time(current_time);
            if (exisiting_cue)
                self.edit_caption(exisiting_cue.id, true);
            else
                self.status_event();

            if (!exisiting_cue && self.edit_cue) {
                self.caption_text.val('');
                self.edit_cue = false;
            }
            //     self.caption_cancel_event(true);

            //self.timeline_list.find('li.'+self.get_time_class(current_time)).prevAll().addClass('active');
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

        this.load_vtt = function() {
            var content = self.val_value.val();
            self.parse_cues(content);
            $.each(self.captions, function(key, cue){
                self.current_headpoint = cue.end;
                self.last_headpoint = cue.end;
                self.current_id = cue.id;
                self.create_cue(cue);
            });
            self.current_id++;
            self.rebuild_list();
        };

        this.trim = function(string) {
            return string.toString().replace(/^\s+/, "").replace(/\s+$/, "");
        };

        this.init();

    };



})(jQuery);