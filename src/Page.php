<?php

interface Page {

        public function title();

        public function href($classes = '');

        public function strapline();
}
